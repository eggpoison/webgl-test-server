import { EntityType, flipAngle, SETTINGS, Vector } from "webgl-test-shared";
import Entity from "../entities/Entity";
import { SERVER } from "../server";
import Component from "./Component";

export type CircularHitbox = {
   readonly type: "circular";
   readonly radius: number;
}

export type RectangularHitbox = {
   readonly type: "rectangular";
   readonly width: number;
   readonly height: number;
}

export type Hitbox = CircularHitbox | RectangularHitbox;

const calculateDistanceBetweenHitboxes = (entity1: Entity<EntityType>, entity2: Entity<EntityType>, entity1HitboxComponent: HitboxComponent, entity2HitboxComponent: HitboxComponent): number => {
   // Circle-circle hitbox distance
   if (entity1HitboxComponent.hitbox.type === "circular" && entity2HitboxComponent.hitbox.type === "circular") {
      const positionDist = entity1.position.distanceFrom(entity2.position);

      return positionDist - entity1HitboxComponent.hitbox.radius - entity2HitboxComponent.hitbox.radius;
   }

   throw new Error(`No distance calculations for collision between hitboxes of type ${entity1HitboxComponent.hitbox.type} and ${entity2HitboxComponent.hitbox.type}`);
}

const calculateMaxHitboxDistance = (hitbox1: Hitbox, hitbox2: Hitbox): number => {
   // Circle-circle collision
   if (hitbox1.type === "circular" && hitbox2.type === "circular") {
      return hitbox1.radius + hitbox2.radius;
   }

   throw new Error(`No max distance calculations for collision between hitboxes of type ${hitbox1.type} and ${hitbox2.type}`);
}

class HitboxComponent extends Component {
   private static readonly MAX_ENTITY_COLLISION_PUSH_FORCE = 400;
   
   public readonly hitbox: Hitbox;

   private halfWidth!: number;
   private halfHeight!: number;

   private entityCollisions: Array<number> = [];

   constructor(hitbox: Hitbox) {
      super();

      this.hitbox = hitbox;
      
      this.calculateHalfSize();
   }

   public tick(): void {
      this.handleEntityCollisions();
   }

   // Calculate the size of the entity
   private calculateHalfSize(): void {
      switch (this.hitbox.type) {
         case "circular": {
            this.halfWidth = this.hitbox.radius;
            this.halfHeight = this.hitbox.radius;
            break;
         }
         case "rectangular": {
            this.halfWidth = this.hitbox.width / 2;
            this.halfHeight = this.hitbox.height / 2;
            break;
         }
      }
   }

   private handleEntityCollisions(): void {
      const collidingEntityInfo = this.getCollidingEntities();

      this.entityCollisions = collidingEntityInfo.map(([entity]) => entity.id);

      for (const [entity, dist] of collidingEntityInfo) {
         
         const maxDist = calculateMaxHitboxDistance(this.hitbox, entity.getComponent(HitboxComponent)!.hitbox);

         const distMultiplier = Math.pow(-dist / maxDist, 2);

         // Push both entities away from each other
         const force = HitboxComponent.MAX_ENTITY_COLLISION_PUSH_FORCE * distMultiplier / SETTINGS.TPS;;
         const angle = this.entity.position.angleBetween(entity.position);
         const flippedAngle = flipAngle(angle);

         const push = new Vector(force, flippedAngle);
         this.entity.velocity = this.entity.velocity !== null ? this.entity.velocity.add(push) : push;
         const push2 = new Vector(force, angle);
         entity.velocity = entity.velocity !== null ? entity.velocity.add(push2) : push2;
      }
   }

   private getCollidingEntities(): ReadonlyArray<[entity: Entity<EntityType>, distance: number]> {
      const collidingEntityInfo = new Array<[entity: Entity<EntityType>, distance: number]>();

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

               const dist = calculateDistanceBetweenHitboxes(this.entity, entity, this, hitboxComponent);
               if (dist <= 0) collidingEntityInfo.push([entity, dist]);
            }
         }
      }

      return collidingEntityInfo;
   }
}

export default HitboxComponent;