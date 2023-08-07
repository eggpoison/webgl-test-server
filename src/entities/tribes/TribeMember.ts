import { EntityType, Point, SETTINGS, TribeType, Vector } from "webgl-test-shared";
import Entity from "../Entity";
import InventoryComponent from "../../entity-components/InventoryComponent";
import HealthComponent from "../../entity-components/HealthComponent";
import { SERVER } from "../../server";
import TRIBE_INFO_RECORD from "webgl-test-shared/lib/tribes";
import Tribe from "../../Tribe";
import TribeHut from "./TribeHut";
import TribeTotem from "./TribeTotem";
import Mob from "../mobs/Mob";
import Board from "../../Board";

abstract class TribeMember extends Mob {
   public readonly tribeType: TribeType;

   public tribe: Tribe | null = null;

   private numFootstepsTaken = 0;

   constructor(position: Point, entityType: EntityType, visionRange: number, isNaturallySpawned: boolean, tribeType: TribeType) {
      const tribeInfo = TRIBE_INFO_RECORD[tribeType];

      super(position, {
         health: new HealthComponent(tribeInfo.maxHealth, true),
         inventory: new InventoryComponent()
      }, entityType, visionRange, isNaturallySpawned);

      this.tribeType = tribeType;

      this.createEvent("hurt", (_1, _2, _3, hitDirection: number | null): void => {
         this.createBloodPoolParticle();

         if (hitDirection !== null) {
            for (let i = 0; i < 10; i++) {
               this.createBloodParticle(hitDirection);
            }
         }
      });

      this.createEvent("on_item_place", (placedItem: Entity): void => {
         if (placedItem.type === "tribe_totem") {
            const tribe = new Tribe(this.tribeType, placedItem as TribeTotem);
            this.setTribe(tribe);
         } else if (placedItem.type === "tribe_hut") {
            if (this.tribe === null) {
               throw new Error("Tribe member didn't belong to a tribe when placing a hut");
            }

            this.tribe.registerNewHut(placedItem as TribeHut);
         }
      });
   }

   public setTribe(tribe: Tribe | null): void {
      if (tribe !== null) {
         tribe.addTribeMember(this);
      }
      this.tribe = tribe;
   }

   public tick(): void {
      super.tick();

      if (this.acceleration !== null && this.velocity !== null && SERVER.tickIntervalHasPassed(0.15)) {
         this.createFootprintParticle(this.numFootstepsTaken, 20);

         this.numFootstepsTaken++;
      }
   }

   protected calculateAttackTarget(targetEntities: ReadonlyArray<Entity>): Entity | null {
      let closestEntity: Entity | null = null;
      let minDistance = Number.MAX_SAFE_INTEGER;
      for (const entity of targetEntities) {
         if (typeof entity === "undefined") continue;

         // Don't attack entities without health components
         if (entity.getComponent("health") === null) continue;

         // Don't attack tribe buildings of the same tribe
         if (this.tribe !== null && entity instanceof TribeHut && this.tribe.hasHut(entity)) {
            continue;
         }
         if (this.tribe !== null && entity instanceof TribeTotem && this.tribe.hasTotem(entity)) {
            continue;
         }

         // Don't attack fellow tribe members
         if (this.tribe !== null && entity instanceof TribeMember && entity.tribe !== null && entity.tribe === this.tribe) {
            continue;
         }

         const dist = this.position.calculateDistanceBetween(entity.position);
         if (dist < minDistance) {
            closestEntity = entity;
            minDistance = dist;
         }
      }

      if (closestEntity === null) return null;

      return closestEntity;
   }

   protected calculateRadialAttackTargets(attackOffset: number, attackRadius: number): ReadonlyArray<Entity> {
      const offset = new Vector(attackOffset, this.rotation);
      const attackPosition = this.position.copy();
      attackPosition.add(offset.convertToPoint());

      const minChunkX = Math.max(Math.min(Math.floor((attackPosition.x - attackRadius) / SETTINGS.CHUNK_SIZE / SETTINGS.TILE_SIZE), SETTINGS.BOARD_SIZE - 1), 0);
      const maxChunkX = Math.max(Math.min(Math.floor((attackPosition.x + attackRadius) / SETTINGS.CHUNK_SIZE / SETTINGS.TILE_SIZE), SETTINGS.BOARD_SIZE - 1), 0);
      const minChunkY = Math.max(Math.min(Math.floor((attackPosition.y - attackRadius) / SETTINGS.CHUNK_SIZE / SETTINGS.TILE_SIZE), SETTINGS.BOARD_SIZE - 1), 0);
      const maxChunkY = Math.max(Math.min(Math.floor((attackPosition.y + attackRadius) / SETTINGS.CHUNK_SIZE / SETTINGS.TILE_SIZE), SETTINGS.BOARD_SIZE - 1), 0);

      // Find all attacked entities
      const attackedEntities = new Array<Entity>();
      for (let chunkX = minChunkX; chunkX <= maxChunkX; chunkX++) {
         for (let chunkY = minChunkY; chunkY <= maxChunkY; chunkY++) {
            const chunk = Board.getChunk(chunkX, chunkY);

            for (const entity of chunk.getEntities()) {
               // Skip entities that are already in the array
               if (attackedEntities.includes(entity)) continue;

               const dist = attackPosition.calculateDistanceBetween(entity.position);
               if (dist <= attackRadius) attackedEntities.push(entity);
            }
         }
      }
      
      // Don't attack yourself
      while (true) {
         const idx = attackedEntities.indexOf(this);
         if (idx !== -1) {
            attackedEntities.splice(idx, 1);
         } else {
            break;
         }
      }

      return attackedEntities;
   }
}

export default TribeMember;