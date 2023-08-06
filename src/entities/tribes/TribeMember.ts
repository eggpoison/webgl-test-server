import { EntityType, Point, TribeType } from "webgl-test-shared";
import Entity from "../Entity";
import InventoryComponent from "../../entity-components/InventoryComponent";
import HealthComponent from "../../entity-components/HealthComponent";
import { SERVER } from "../../server";
import TRIBE_INFO_RECORD from "webgl-test-shared/lib/tribes";
import Tribe from "../../Tribe";
import TribeTotem from "./TribeTotem";

abstract class TribeMember extends Entity {
   public readonly tribeType: TribeType;

   private tribe: Tribe | null = null;

   private numFootstepsTaken = 0;

   constructor(position: Point, entityType: EntityType, isNaturallySpawned: boolean, tribeType: TribeType) {
      const tribeInfo = TRIBE_INFO_RECORD[tribeType];
      
      super(position, {
         health: new HealthComponent(tribeInfo.maxHealth, true),
         inventory: new InventoryComponent()
      }, entityType, isNaturallySpawned);

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
            this.updateTribeFromTribeTotem(placedItem as TribeTotem);
         }
      });
   }

   public tick(): void {
      super.tick();

      if (this.acceleration !== null && this.velocity !== null && SERVER.tickIntervalHasPassed(0.15)) {
         this.createFootprintParticle(this.numFootstepsTaken, 20);

         this.numFootstepsTaken++;
      }
   }

   protected updateTribeFromTribeTotem(tribeTotem: TribeTotem): void {
      this.tribe = tribeTotem.tribe;
   }
}

export default TribeMember;