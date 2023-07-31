import { Point, SETTINGS } from "webgl-test-shared";
import Mob from "./Mob";
import HealthComponent from "../../entity-components/HealthComponent";
import ItemCreationComponent from "../../entity-components/ItemCreationComponent";
import CircularHitbox from "../../hitboxes/CircularHitbox";
import Entity from "../Entity";
import { GameObject } from "../../GameObject";

class Slime extends Mob {
   private static readonly MAX_HEALTH = 15;

   private static readonly RADIUS = 40;

   private static readonly CONTACT_DAMAGE = 1;

   private eyeRotation = 0;

   private eyeLookTarget: GameObject | null = null;
   
   constructor(position: Point, isNaturallySpawned: boolean) {
      super(position, {
         health: new HealthComponent(Slime.MAX_HEALTH, false),
         item_creation: new ItemCreationComponent()
      }, "slime", 250, isNaturallySpawned);

      this.addAI("wander", {
         aiWeightMultiplier: 0.5,
         acceleration: 100,
         terminalVelocity: 50,
         wanderRate: 0.5,
         validTileTargets: new Set(["sludge", "slime"])
      });
      this.addAI("chase", {
         aiWeightMultiplier: 1,
         acceleration: 100,
         terminalVelocity: 50,
         entityIsChased: (entity: Entity) => {
            return entity.type !== "slime";
         }
      })

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
            healthComponent.damage(Slime.CONTACT_DAMAGE, 0, null, this, "slime");
            healthComponent.addLocalInvulnerabilityHash("slime", 0.3);
         }
      });
   }

   public tick(): void {
      super.tick();
      
      let closestEntity: Entity | null = null;
      let distanceToClosestEntity = Number.MAX_SAFE_INTEGER;
      for (const entity of this.entitiesInVisionRange) {
         if (entity.type === "slime") continue;
         
         const distance = this.position.calculateDistanceBetween(entity.position);
         if (distance < distanceToClosestEntity) {
            closestEntity = entity;
            distanceToClosestEntity = distance;
         }
      }

      this.eyeLookTarget = closestEntity;

      // if (typeof closestEntity !== "undefined") {
      //    const angle = this.position.calculateAngleBetween(closestEntity.position);
      //    this.eyeRotation = angle;
      // }

      // When the slime isn't chasing an entity, make it look at random positions
      // if (this.getCurrentAIType() !== "chase") {
      //    if (Math.random() < 0.25 / SETTINGS.TPS) {
      //       this.eyeRotation = 2 * Math.PI * Math.random();
      //    }
      // }
   }
   
   public getClientArgs(): [eyeRotation: number] {
      if (this.eyeLookTarget !== null) {
         const directionToLookTarget = this.position.calculateAngleBetween(this.eyeLookTarget.position);
         return [directionToLookTarget];
      }
      return [this.eyeRotation];
   }
}

export default Slime;