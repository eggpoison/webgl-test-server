import { Point, SETTINGS, SlimeSize } from "webgl-test-shared";
import Mob from "./Mob";
import HealthComponent from "../../entity-components/HealthComponent";
import ItemCreationComponent from "../../entity-components/ItemCreationComponent";
import CircularHitbox from "../../hitboxes/CircularHitbox";
import Entity from "../Entity";
import Board from "../../Board";

class Slime extends Mob {
   private static readonly MAX_HEALTH = 15;

   private static readonly RADIUSES: ReadonlyArray<number> = [
      32, // small
      44, // medium
      60  // large
   ];

   private static readonly CONTACT_DAMAGE: ReadonlyArray<number> = [
      1, // small
      2, // medium
      3  // large
   ];

   private static readonly SPEED_MULTIPLIERS: ReadonlyArray<number> = [
      2.5, // small
      1.75, // medium
      1  // large
   ];

   // Weights of each type of slime and slimewisp used when merging
   private static readonly SLIME_WEIGHTS: ReadonlyArray<number> = [
      1, // slimewisp
      2, // small slime
      5, // medium slime
      11 // large slime
   ];

   private eyeRotation = 0;

   private size: SlimeSize;

   constructor(position: Point, isNaturallySpawned: boolean, size: SlimeSize = SlimeSize.small) {
      super(position, {
         health: new HealthComponent(Slime.MAX_HEALTH, false),
         item_creation: new ItemCreationComponent()
      }, "slime", 250, isNaturallySpawned);

      const speedMultiplier = Slime.SPEED_MULTIPLIERS[size];

      this.addAI("wander", {
         aiWeightMultiplier: 0.5,
         acceleration: 60 * speedMultiplier,
         terminalVelocity: 30 * speedMultiplier,
         wanderRate: 0.5,
         validTileTargets: new Set(["sludge", "slime"]),
         shouldWander: (position: Point): boolean => {
            const tileX = Math.floor(position.x / SETTINGS.TILE_SIZE);
            const tileY = Math.floor(position.y / SETTINGS.TILE_SIZE);
            const tile = Board.getTile(tileX, tileY);
            return tile.biomeName === "swamp";
         }
      });
      this.addAI("chase", {
         aiWeightMultiplier: 1,
         acceleration: 100 * speedMultiplier,
         terminalVelocity: 50 * speedMultiplier,
         entityIsChased: (entity: Entity) => {
            return entity.type !== "slime" && entity.type !== "slimewisp";
         },
         callback: (): void => {
            
         }
      });

      this.size = size;

      const radius = Slime.RADIUSES[this.size];
      this.addHitboxes([
         new CircularHitbox({
            type: "circular",
            radius: radius
         })
      ]);

      this.createEvent("during_entity_collision", (collidingEntity: Entity): void => {
         if (collidingEntity.type === "slime" || collidingEntity.type !== "slimewisp") return;
         
         const healthComponent = collidingEntity.getComponent("health");
         if (healthComponent !== null) {
            const contactDamage = Slime.CONTACT_DAMAGE[this.size];
            healthComponent.damage(contactDamage, 0, null, this, "slime");
            healthComponent.addLocalInvulnerabilityHash("slime", 0.3);
         }
      });
   }

   public tick(): void {
      super.tick();
      
      let closestEntity: Entity | null = null;
      let distanceToClosestEntity = Number.MAX_SAFE_INTEGER;
      for (const entity of this.entitiesInVisionRange) {
         if (entity.type === "slime" || entity.type === "slimewisp") continue;
         
         const distance = this.position.calculateDistanceBetween(entity.position);
         if (distance < distanceToClosestEntity) {
            closestEntity = entity;
            distanceToClosestEntity = distance;
         }
      }

      if (closestEntity !== null && closestEntity.type !== "slime") {
         this.eyeRotation = this.position.calculateAngleBetween(closestEntity.position);
      } else {
         // When the slime isn't chasing an entity, make it look at random positions
         if (this.getCurrentAIType() !== "chase") {
            if (Math.random() < 0.25 / SETTINGS.TPS) {
               this.eyeRotation = 2 * Math.PI * Math.random();
            }
         }
      }
   }
   
   public getClientArgs(): [size: SlimeSize, eyeRotation: number] {
      return [this.size, this.eyeRotation];
   }
}

export default Slime;