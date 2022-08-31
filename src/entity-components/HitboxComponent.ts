import { CircularHitbox, EntityType, flipAngle, Hitbox, Point, RectangularHitbox, rotatePoint, SETTINGS, Vector } from "webgl-test-shared";
import Entity from "../entities/Entity";
import { SERVER } from "../server";
import Component from "./Component";

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

class HitboxComponent extends Component {
   private static readonly MAX_ENTITY_COLLISION_PUSH_FORCE = 200;
   
   private halfWidth!: number;
   private halfHeight!: number;

   private entityCollisions: Array<number> = [];

   public onLoad(): void {
      this.calculateHalfSize();
   }

   public tick(): void {
      this.handleEntityCollisions();
   }

   // Calculate the size of the entity
   private calculateHalfSize(): void {
      switch (this.entity.hitbox.type) {
         case "circular": {
            this.halfWidth = this.entity.hitbox.radius;
            this.halfHeight = this.entity.hitbox.radius;
            break;
         }
         case "rectangular": {
            this.halfWidth = this.entity.hitbox.width / 2;
            this.halfHeight = this.entity.hitbox.height / 2;
            break;
         }
      }
   }

   private handleEntityCollisions(): void {
      const collidingEntities = this.getCollidingEntities();

      this.entityCollisions = collidingEntities.map(entity => entity.id);

      for (const entity of collidingEntities) {
         // Push both entities away from each other
         const force = HitboxComponent.MAX_ENTITY_COLLISION_PUSH_FORCE / SETTINGS.TPS;
         const angle = this.entity.position.angleBetween(entity.position);

         this.entity.addVelocity(force, angle + Math.PI);
         entity.addVelocity(force, angle);
      }
   }

   private getCollidingEntities(): ReadonlyArray<Entity<EntityType>> {
      const collidingEntityInfo = new Array<Entity<EntityType>>();

      const minChunkX = Math.max(Math.min(Math.floor((this.entity.position.x - this.halfWidth) / SETTINGS.TILE_SIZE / SETTINGS.CHUNK_SIZE), SETTINGS.BOARD_SIZE - 1), 0);
      const maxChunkX = Math.max(Math.min(Math.floor((this.entity.position.x + this.halfWidth) / SETTINGS.TILE_SIZE / SETTINGS.CHUNK_SIZE), SETTINGS.BOARD_SIZE - 1), 0);
      const minChunkY = Math.max(Math.min(Math.floor((this.entity.position.y - this.halfHeight) / SETTINGS.TILE_SIZE / SETTINGS.CHUNK_SIZE), SETTINGS.BOARD_SIZE - 1), 0);
      const maxChunkY = Math.max(Math.min(Math.floor((this.entity.position.y + this.halfHeight) / SETTINGS.TILE_SIZE / SETTINGS.CHUNK_SIZE), SETTINGS.BOARD_SIZE - 1), 0);

      for (let chunkX = minChunkX; chunkX <= maxChunkX; chunkX++) {
         for (let chunkY = minChunkY; chunkY <= maxChunkY; chunkY++) {
            const chunk = SERVER.board.getChunk(chunkX, chunkY);

            for (const entity of chunk.getEntities()) {
               if (entity === this.entity) continue;

               const hitboxComponent = entity.getComponent(HitboxComponent);
               if (hitboxComponent === null) continue;

               if (isColliding(this.entity, entity)) {
                  collidingEntityInfo.push(entity);
               }
            }
         }
      }

      return collidingEntityInfo;
   }
}

export default HitboxComponent;