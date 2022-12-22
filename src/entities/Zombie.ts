import { HitboxType, Point, SETTINGS, Vector } from "webgl-test-shared";
import HealthComponent from "../entity-components/HealthComponent";
import CircularHitbox from "../hitboxes/CircularHitbox";
import Hitbox from "../hitboxes/Hitbox";
import { SERVER } from "../server";
import Entity from "./Entity";
import Mob, { MobAIData } from "./Mob";

class Zombie extends Mob {
   /** Chance for a zombie to spontaneously ignite every second */
   private static readonly SPONTANEOUS_IGNITION_CHANCE = 0.5;

   private static readonly MAX_HEALTH = 20;

   private static readonly DAMAGE = 2;

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

   public readonly type = "zombie";

   /** The type of the zombie, 0-2 */
   private readonly zombieType: number;

   constructor(position: Point) {
      super(position, new Set<Hitbox<HitboxType>>([
         new CircularHitbox({
            type: "circular",
            radius: 32
         })
      ]), {
         health: new HealthComponent(Zombie.MAX_HEALTH, false)
      }, Zombie.MOB_AI_DATA);
      
      this.zombieType = Math.floor(Math.random() * 3);

      // Hurt players on collision
      this.createEvent("enter_collision", (collidingEntity: Entity) => {
         if (collidingEntity.type === "player") {
            collidingEntity.takeDamage(Zombie.DAMAGE, this);

            // Push away from the entity on collision
            const angle = this.position.calculateAngleBetween(collidingEntity.position) + Math.PI;
            const pushForce = new Vector(75, angle);
            if (this.velocity !== null) {
               this.velocity.add(pushForce);
            } else {
               this.velocity = pushForce;
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