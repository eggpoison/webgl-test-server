import { Point, SETTINGS } from "webgl-test-shared";
import Mob from "./Mob";
import HealthComponent from "../../entity-components/HealthComponent";
import ItemCreationComponent from "../../entity-components/ItemCreationComponent";
import CircularHitbox from "../../hitboxes/CircularHitbox";
import Entity from "../Entity";

class Slime extends Mob {
   private static readonly MAX_HEALTH = 15;

   private static readonly RADIUS = 40;

   private static readonly CONTACT_DAMAGE = 1;
   private static readonly CONTACT_KNOCKBACK = 100;
   
   constructor(position: Point, isNaturallySpawned: boolean) {
      super(position, {
         health: new HealthComponent(Slime.MAX_HEALTH, false),
         item_creation: new ItemCreationComponent()
      }, "slime", SETTINGS.TILE_SIZE * 5, isNaturallySpawned);

      this.addAI("wander", {
         aiWeightMultiplier: 1,
         acceleration: 100,
         terminalVelocity: 50,
         wanderRate: 0.5,
         validTileTargets: new Set(["sludge", "slime"])
      });

      this.addHitboxes([
         new CircularHitbox({
            type: "circular",
            radius: Slime.RADIUS
         })
      ]);

      this.createEvent("during_entity_collision", (collidingEntity: Entity): void => {
         if (collidingEntity.type === "slime") return;
         
         const healthComponent = collidingEntity.getComponent("health");
         if (healthComponent !== null) {
            const hitDirection = this.position.calculateAngleBetween(collidingEntity.position);

            healthComponent.damage(Slime.CONTACT_DAMAGE, Slime.CONTACT_KNOCKBACK, hitDirection, this, "slime");
            healthComponent.addLocalInvulnerabilityHash("slime", 0.3);
         }
      })
   }
   
   public getClientArgs(): [] {
      return [];
   }
}

export default Slime;