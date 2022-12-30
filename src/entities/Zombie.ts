import { Point, SETTINGS, Vector } from "webgl-test-shared";
import HealthComponent from "../entity-components/HealthComponent";
import CircularHitbox from "../hitboxes/CircularHitbox";
import { SERVER } from "../server";
import Entity from "./Entity";
import Mob, { MobAIData } from "./Mob";

class Zombie extends Mob {
   /** Chance for a zombie to spontaneously ignite every second */
   private static readonly SPONTANEOUS_IGNITION_CHANCE = 0.5;

   private static readonly MAX_HEALTH = 20;

   private static readonly ATTACK_DAMAGE = 2;
   private static readonly ATTACK_KNOCKBACK = 150;

   private static readonly MOB_AI_DATA: MobAIData = {
      info: {
         visionRange: SETTINGS.TILE_SIZE * 5
      },
      aiCreationInfo: {
         wander: {
            aiWeightMultiplier: 0.5,
            wanderRate: 0.4,
            acceleration: 100,
            terminalVelocity: 50
         },
         herd: {
            aiWeightMultiplier: 0.8,
            acceleration: 100,
            terminalVelocity: 50,
            minSeperationDistance: 50,
            turnRate: 0.2,
            maxWeightInflenceCount: 3,
            weightInfluenceFalloff: {
               start: 6,
               duration: 3
            },
            validHerdMembers: new Set(["zombie"]),
            seperationInfluence: 0.4,
            alignmentInfluence: 0.5,
            cohesionInfluence: 0.8
         },
         chase: {
            aiWeightMultiplier: 1,
            acceleration: 200,
            terminalVelocity: 125,
            targetEntityTypes: new Set(["player"])
         }
      }
   };

   /** The type of the zombie, 0-3 */
   private readonly zombieType: number;

   constructor(position: Point, isGolden: boolean = false) {
      super(position, {
         health: new HealthComponent(Zombie.MAX_HEALTH, false)
      }, "zombie", Zombie.MOB_AI_DATA);

      this.addHitboxes([
         new CircularHitbox({
            type: "circular",
            radius: 32
         })
      ]);
      
      if (isGolden) {
         this.zombieType = 3;
      } else {
         this.zombieType = Math.floor(Math.random() * 3);
      }

      // Hurt players on collision
      this.createEvent("during_collision", (collidingEntity: Entity) => {
         if (collidingEntity.type === "player") {
            const angleFromTarget = this.position.calculateAngleBetween(collidingEntity.position);
            
            // Push away from the entity on collision
            if (collidingEntity.takeDamage(Zombie.ATTACK_DAMAGE, Zombie.ATTACK_KNOCKBACK, angleFromTarget, this)) {
                  const pushDirection = angleFromTarget + Math.PI;
                  const pushForce = new Vector(75, pushDirection);
                  if (this.velocity !== null) {
                  this.velocity.add(pushForce);
               } else {
                  this.velocity = pushForce;
               }
            }
         }
      });
   }

   public tick(): void {
      super.tick();

      // If day time, ignite
      if (SERVER.time >= 6 && SERVER.time < 18) {
         // Ignite randomly or stay on fire if already on fire
         if (super.hasStatusEffect("fire") || Math.random() < Zombie.SPONTANEOUS_IGNITION_CHANCE / SETTINGS.TPS) {
            super.applyStatusEffect("fire", 5);
         }
      }
   }

   public getClientArgs(): [zombieType: number] {
      return [this.zombieType];
   }
}

export default Zombie;