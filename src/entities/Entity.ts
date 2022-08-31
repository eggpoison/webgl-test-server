import Chunk from "../Chunk";
import { CircularHitbox, EntityInfoClientArgs, EntityType, Hitbox, Point, RectangularHitbox, rotatePoint, SETTINGS, Tile, TILE_TYPE_INFO_RECORD, Vector } from "webgl-test-shared";
import Component from "../entity-components/Component";
import { SERVER } from "../server";

let idCounter = 0;

/** Finds a unique available ID for an entity */
const findAvailableID = (): number => {
   return idCounter++;
}

// https://www.jkh.me/files/tutorials/Separating%20Axis%20Theorem%20for%20Oriented%20Bounding%20Boxes.pdf
const rectanglesDoIntersect = (rect1Pos: Point, rect1Hitbox: RectangularHitbox, rect2Pos: Point, rect2Hitbox: RectangularHitbox): boolean => {
   const x1 = rect1Pos.x;
   const y1 = rect1Pos.y;
   const x2 = rect2Pos.x;
   const y2 = rect2Pos.y;

   const w1 = rect1Hitbox.width / 2;
   const h1 = rect1Hitbox.height / 2;
   const w2 = rect2Hitbox.width / 2;
   const h2 = rect2Hitbox.height / 2;

   const T = rect1Pos.distanceFrom(rect2Pos);

   if (Math.abs(T * x1) > w1 + Math.abs(w2 * x2 * x1) + Math.abs(h2 * y2 * x1)) {
      return false;
   } else if (Math.abs(T * y1) > h1 + Math.abs(w2 * x2 * y1) + Math.abs(h2 * y2 * y1)) {
      return false;
   } else if (Math.abs(T * x2) > Math.abs(w1 * x1 * x2) + Math.abs(h1 * y1 * x2) + w2) {
      return false;
   } else if (Math.abs(T * y2) > Math.abs(w2 * x1 * y2) + Math.abs(h1 * y1 * y2) + h2) {
      return false;
   }
   return true;
}

const rectangleAndCircleDoIntersect = (rectPos: Point, rectHitbox: RectangularHitbox, circlePos: Point, circleHitbox: CircularHitbox, rectRotation: number): boolean => {
   // Rotate the point
   const circularHitboxPosition = rotatePoint(circlePos, rectPos, -rectRotation);
   
   const minX = rectPos.x - rectHitbox.width / 2;
   const maxX = rectPos.x + rectHitbox.width / 2;
   const minY = rectPos.y - rectHitbox.height / 2;
   const maxY = rectPos.y + rectHitbox.height / 2;

   // https://stackoverflow.com/questions/5254838/calculating-distance-between-a-point-and-a-rectangular-box-nearest-point
   var dx = Math.max(minX - circularHitboxPosition.x, 0, circularHitboxPosition.x - maxX);
   var dy = Math.max(minY - circularHitboxPosition.y, 0, circularHitboxPosition.y - maxY);

   const dist = Math.sqrt(dx * dx + dy * dy) - circleHitbox.radius;
   return dist <= 0;
} 

const isColliding = (entity1: Entity<EntityType>, entity2: Entity<EntityType>): boolean => {
   // Circle-circle collisions
   if (entity1.hitbox.type === "circular" && entity2.hitbox.type === "circular") {
      const dist = entity1.position.distanceFrom(entity2.position);

      return dist - entity1.hitbox.radius - entity2.hitbox.radius <= 0;
   }
   // Circle-rectangle collisions
   else if ((entity1.hitbox.type === "circular" && entity2.hitbox.type === "rectangular") || (entity1.hitbox.type === "rectangular" && entity2.hitbox.type === "circular")) {
      let circleEntity: Entity<EntityType>;
      let rectEntity: Entity<EntityType>;
      if (entity1.hitbox.type === "circular") {
         circleEntity = entity1;
         rectEntity = entity2;
      } else {
         rectEntity = entity1;
         circleEntity = entity2;
      }

      return rectangleAndCircleDoIntersect(rectEntity.position, rectEntity.hitbox as RectangularHitbox, circleEntity.position, circleEntity.hitbox as CircularHitbox, rectEntity.rotation);
   }
   // Rectangle-rectangle collisions
   else if (entity1.hitbox.type === "rectangular" && entity2.hitbox.type === "rectangular") {
      return rectanglesDoIntersect(entity1.position, entity1.hitbox, entity2.position, entity2.hitbox);
   }

   throw new Error(`No collision calculations for collision between hitboxes of type ${entity1.hitbox.type} and ${entity2.hitbox.type}`);
}

abstract class Entity<T extends EntityType> {
   private static readonly MAX_ENTITY_COLLISION_PUSH_FORCE = 200;
   
   private readonly components = new Map<(abstract new (...args: any[]) => any), Component>();

   /** Unique identifier for every entity */
   public readonly id: number = findAvailableID();
   /** Type of the entity (e.g. "cow") */
   public abstract readonly type: T;

   public abstract readonly hitbox: Hitbox;

   /** Position of the entity */
   public position: Point;
   /** Velocity of the entity */
   public velocity: Vector | null = null;
   /** Amount of units that the entity's speed increases in a second */
   public acceleration: Vector | null = null;
   /** Limit to how many units the entity can move in a second */
   public terminalVelocity: number = 0;

   /** Direction the entity is facing (radians). Used in client side rendering */
   public rotation: number;

   private entityCollisions: Array<number> = [];

   public previousChunk: Chunk;

   public isRemoved: boolean = false;

   constructor(position: Point, velocity: Vector | null, acceleration: Vector | null, rotation: number, components: Array<Component>) {
      this.position = position;
      this.velocity = velocity;
      this.acceleration = acceleration;

      this.rotation = rotation;

      this.previousChunk = this.findContainingChunk();

      for (const component of components) {
         this.components.set(component.constructor as (new (...args: any[]) => any), component);

         component.setEntity(this);
      }
   }

   public onLoad?(): void;

   public loadComponents(): void {
      this.components.forEach(component => {
         if (typeof component.onLoad !== "undefined") component.onLoad();
      });
   }

   public abstract getClientArgs(): Parameters<EntityInfoClientArgs[T]>;

   public tick(): void {
      this.applyPhysics();

      const hitboxBounds = this.calculateHitboxBounds();
      this.resolveWallCollisions(hitboxBounds);
      this.handleEntityCollisions(hitboxBounds);

      this.components.forEach(component => {
         if (typeof component.tick !== "undefined") {
            component.tick();
         }
      });
   }

   public findCurrentTile(): Tile {
      const [x, y] = this.findCurrentTileCoordinates();
      return SERVER.board.tiles[x][y];
   }

   public findCurrentTileCoordinates(): [number, number] {
      const tileX = Math.floor(this.position.x / SETTINGS.TILE_SIZE);
      const tileY = Math.floor(this.position.y / SETTINGS.TILE_SIZE);
      return [tileX, tileY];
   }

   public getComponent<C extends Component>(constr: { new(...args: any[]): C }): C | null {
      const component = this.components.get(constr);
      return typeof component !== "undefined" ? (component as C) : null;
   }

   public getChunkCoords(): [number, number] {
      const x = Math.floor(this.position.x / SETTINGS.TILE_SIZE / SETTINGS.CHUNK_SIZE);
      const y = Math.floor(this.position.y / SETTINGS.TILE_SIZE / SETTINGS.CHUNK_SIZE);
      return [x, y];
   }

   public findContainingChunk(): Chunk {
      const chunkX = Math.floor(this.position.x / SETTINGS.TILE_SIZE / SETTINGS.CHUNK_SIZE);
      const chunkY = Math.floor(this.position.y / SETTINGS.TILE_SIZE / SETTINGS.CHUNK_SIZE);

      return SERVER.board.chunks[chunkX][chunkY];
   }

   public addVelocity(magnitude: number, direction: number): void {
      const velocity = new Vector(magnitude, direction);
      this.velocity = this.velocity?.add(velocity) || velocity;
   }

   private applyPhysics(): void {
      const tile = this.findCurrentTile();
      const tileTypeInfo = TILE_TYPE_INFO_RECORD[tile.type];

      const terminalVelocity = this.terminalVelocity * (tileTypeInfo.moveSpeedMultiplier || 1);
      
      // Apply acceleration
      if (this.acceleration !== null) {
         const acceleration = this.acceleration.copy();
         acceleration.magnitude /= SETTINGS.TPS;

         // Reduce acceleration due to friction
         const friction = tileTypeInfo.friction;
         acceleration.magnitude *= friction;
          
         // Apply tile speed multiplier
         if (typeof tileTypeInfo.moveSpeedMultiplier !== "undefined") {
            acceleration.magnitude *= tileTypeInfo.moveSpeedMultiplier;
         }

         const magnitudeBeforeAdd = this.velocity?.magnitude || 0;
         
         // Add acceleration to velocity
         this.velocity = this.velocity !== null ? this.velocity.add(acceleration) : acceleration;

         // Don't accelerate past terminal velocity
         if (this.velocity.magnitude > terminalVelocity && this.velocity.magnitude > magnitudeBeforeAdd) {
            this.velocity.magnitude = magnitudeBeforeAdd;
         }
      }
      // Apply friction if the entity isn't accelerating
      else if (this.velocity !== null) { 
         const friction = tileTypeInfo.friction * SETTINGS.GLOBAL_FRICTION_CONSTANT / SETTINGS.TPS;
         this.velocity.magnitude /= 1 + friction;
      }

      // Restrict the entity's velocity to their terminal velocity
      if (this.velocity !== null && terminalVelocity > 0) {
         const mach = Math.abs(this.velocity.magnitude / terminalVelocity);
         if (mach > 1) {
            this.velocity.magnitude /= 1 + (mach - 1) / SETTINGS.TPS;
         }
      }

      // Apply velocity
      if (this.velocity !== null) {
         const velocity = this.velocity.copy();
         velocity.magnitude /= SETTINGS.TPS;
         
         this.position = this.position.add(velocity.convertToPoint());
      }
   }

   private stopXVelocity(): void {
      if (this.velocity !== null) {
         const pointVelocity = this.velocity.convertToPoint();
         pointVelocity.x = 0;
         this.velocity = pointVelocity.convertToVector();
      }
   }

   private stopYVelocity(): void {
      if (this.velocity !== null) {
         // Stop y velocity
         const pointVelocity = this.velocity.convertToPoint();
         pointVelocity.y = 0;
         this.velocity = pointVelocity.convertToVector();
      }
   }

   private calculateHitboxBounds(): [minX: number, maxX: number, minY: number, maxY: number] {
      let minX: number;
      let maxX: number;
      let minY: number;
      let maxY: number;

      switch (this.hitbox.type) {
         case "circular": {
            minX = this.position.x - this.hitbox.radius;
            maxX = this.position.x + this.hitbox.radius;
            minY = this.position.y - this.hitbox.radius;
            maxY = this.position.y + this.hitbox.radius;

            break;
         }
         case "rectangular": {
            const x1 = this.position.x - this.hitbox.width / 2;
            const x2 = this.position.x + this.hitbox.width / 2;
            const y1 = this.position.y - this.hitbox.height / 2;
            const y2 = this.position.y + this.hitbox.height / 2;

            let topLeft = new Point(x1, y2);
            let topRight = new Point(x2, y2);
            let bottomRight = new Point(x2, y1);
            let bottomLeft = new Point(x1, y1);

            // Rotate the points to match the entity's rotation
            const rotation = -this.rotation + Math.PI/2;
            topLeft = rotatePoint(topLeft, this.position, rotation);
            topRight = rotatePoint(topRight, this.position, rotation);
            bottomRight = rotatePoint(bottomRight, this.position, rotation);
            bottomLeft = rotatePoint(bottomLeft, this.position, rotation);

            minX = Math.min(topLeft.x, topRight.x, bottomRight.x, bottomLeft.x);
            maxX = Math.max(topLeft.x, topRight.x, bottomRight.x, bottomLeft.x);
            minY = Math.min(topLeft.y, topRight.y, bottomRight.y, bottomLeft.y);
            maxY = Math.max(topLeft.y, topRight.y, bottomRight.y, bottomLeft.y);

            break;
         }
      }

      return [minX, maxX, minY, maxY];
   }
   
   private resolveWallCollisions([minX, maxX, minY, maxY]: [number, number, number, number]): void {
      const boardUnits = SETTINGS.BOARD_DIMENSIONS * SETTINGS.TILE_SIZE;

      // Left wall
      if (minX < 0) {
         this.stopXVelocity();
         this.position.x -= minX;
      // Right wall
      } else if (maxX > boardUnits) {
         this.position.x -= maxX - boardUnits;
         this.stopXVelocity();
      }

      // Bottom wall
      if (minY < 0) {
         this.position.y -= minY;
         this.stopYVelocity();
      // Top wall
      } else if (maxY > boardUnits) {
         this.position.y -= maxY - boardUnits;
         this.stopYVelocity();
      }
   }

   private handleEntityCollisions(hitboxBounds: [number, number, number, number]): void {
      const collidingEntities = this.getCollidingEntities(hitboxBounds);

      this.entityCollisions = collidingEntities.map(entity => entity.id);

      for (const entity of collidingEntities) {
         // Push both entities away from each other
         const force = Entity.MAX_ENTITY_COLLISION_PUSH_FORCE / SETTINGS.TPS;
         const angle = this.position.angleBetween(entity.position);

         this.addVelocity(force, angle + Math.PI);
         entity.addVelocity(force, angle);
      }
   }

   private getCollidingEntities([minX, maxX, minY, maxY]: [number, number, number, number]): ReadonlyArray<Entity<EntityType>> {
      const collidingEntityInfo = new Array<Entity<EntityType>>();

      const minChunkX = Math.max(Math.min(Math.floor(minX / SETTINGS.TILE_SIZE / SETTINGS.CHUNK_SIZE), SETTINGS.BOARD_SIZE - 1), 0);
      const maxChunkX = Math.max(Math.min(Math.floor(maxX / SETTINGS.TILE_SIZE / SETTINGS.CHUNK_SIZE), SETTINGS.BOARD_SIZE - 1), 0);
      const minChunkY = Math.max(Math.min(Math.floor(minY / SETTINGS.TILE_SIZE / SETTINGS.CHUNK_SIZE), SETTINGS.BOARD_SIZE - 1), 0);
      const maxChunkY = Math.max(Math.min(Math.floor(maxY / SETTINGS.TILE_SIZE / SETTINGS.CHUNK_SIZE), SETTINGS.BOARD_SIZE - 1), 0);

      for (let chunkX = minChunkX; chunkX <= maxChunkX; chunkX++) {
         for (let chunkY = minChunkY; chunkY <= maxChunkY; chunkY++) {
            const chunk = SERVER.board.getChunk(chunkX, chunkY);

            for (const entity of chunk.getEntities()) {
               if (entity === this) continue;

               if (isColliding(this, entity)) {
                  collidingEntityInfo.push(entity);
               }
            }
         }
      }

      return collidingEntityInfo;
   }
}

export default Entity;