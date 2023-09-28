import { ItemType, PlayerCauseOfDeath, Point, SETTINGS, randInt } from "webgl-test-shared";
import HealthComponent from "../../entity-components/HealthComponent";
import ItemCreationComponent from "../../entity-components/ItemCreationComponent";
import Mob from "./Mob";
import CircularHitbox from "../../hitboxes/CircularHitbox";
import Entity from "../Entity";

class FrozenYeti extends Mob {
   private static readonly SIZE = 144;

   private static readonly MAX_HEALTH = 250;

   private static readonly CONTACT_DAMAGE = 5;
   private static readonly CONTACT_KNOCKBACK = 250;

   public mass = 5;

   constructor(position: Point) {
      super(position, {
         health: new HealthComponent(FrozenYeti.MAX_HEALTH, false),
         item_creation: new ItemCreationComponent(FrozenYeti.SIZE / 2)
      }, "frozen_yeti", SETTINGS.TILE_SIZE * 4);

      this.getComponent("item_creation")!.createItemOnDeath(ItemType.deep_frost_heart, randInt(2, 3), true);
      this.getComponent("item_creation")!.createItemOnDeath(ItemType.yeti_hide, randInt(5, 7), true);
      this.getComponent("item_creation")!.createItemOnDeath(ItemType.raw_beef, randInt(13, 18), false);

      const hitbox = new CircularHitbox();
      hitbox.setHitboxInfo(FrozenYeti.SIZE / 2);
      this.addHitbox(hitbox);

      this.createEvent("during_entity_collision", (collidingEntity: Entity) => {
         if (collidingEntity === null) {
            return;
         }

         const healthComponent = collidingEntity.getComponent("health");
         if (healthComponent !== null) {
            const hitDirection = this.position.calculateAngleBetween(collidingEntity.position);
            healthComponent.damage(FrozenYeti.CONTACT_DAMAGE, FrozenYeti.CONTACT_KNOCKBACK, hitDirection, this, PlayerCauseOfDeath.yeti, 0, "frozen_yeti");
            healthComponent.addLocalInvulnerabilityHash("frozen_yeti", 0.3);
         }
      });
   }
   
   public getClientArgs(): [] {
      return [];
   }
}

export default FrozenYeti;