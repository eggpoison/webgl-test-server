import { Point, SETTINGS, randFloat } from "webgl-test-shared";
import HealthComponent from "../../entity-components/HealthComponent";
import CircularHitbox from "../../hitboxes/CircularHitbox";
import Entity from "../Entity";
import Mob from "./Mob";
import Board from "../../Board";
import WanderAI from "../../mob-ai/WanderAI";
import HerdAI from "../../mob-ai/HerdAI";
import ChaseAI from "../../mob-ai/ChaseAI";
import { SERVER } from "../../server";
import ItemCreationComponent from "../../entity-components/ItemCreationComponent";

const zombieShouldTargetEntity = (entity: Entity): boolean => {
   return entity.type === "player" || entity.type === "tribesman" || entity.type === "tribe_totem" || entity.type === "tribe_hut";
}

class Zombie extends Mob {
   /** Chance for a zombie to spontaneously combust every second */
   private static readonly SPONTANEOUS_COMBUSTION_CHANCE = 0.5;

   private static readonly MAX_HEALTH = 20;

   private static readonly ATTACK_DAMAGE = 2;
   private static readonly ATTACK_KNOCKBACK = 150;
   private static readonly ATTACK_SELF_KNOCKBACK = 100;

   /** The type of the zombie, 0-3 */
   private readonly zombieType: number;

   private numFootstepsTaken = 0;

   constructor(position: Point, isNaturallySpawned: boolean, isGolden: boolean = false) {
      const itemCreationComponent = new ItemCreationComponent();
      
      super(position, {
         health: new HealthComponent(Zombie.MAX_HEALTH, false),
         item_creation: itemCreationComponent
      }, "zombie", 270, isNaturallySpawned);

      const speedMultiplier = randFloat(0.9, 1.1);

      this.addAI(new WanderAI(this, {
         aiWeightMultiplier: 0.5,
         wanderRate: 0.4,
         acceleration: 100 * speedMultiplier,
         terminalVelocity: 50
      }));
      this.addAI(new HerdAI(this, {
         aiWeightMultiplier: 0.8,
         acceleration: 100,
         terminalVelocity: 50 * speedMultiplier,
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
      }));
     this.addAI(new ChaseAI(this, {
         aiWeightMultiplier: 1,
         acceleration: 200,
         terminalVelocity: 100 * speedMultiplier,
         entityIsChased: zombieShouldTargetEntity
     }));

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

      this.rotation = 2 * Math.PI * Math.random();

      // Hurt players on collision
      this.createEvent("during_entity_collision", (collidingEntity: Entity) => {
         if (zombieShouldTargetEntity(collidingEntity)) {
            const hitDirection = this.position.calculateAngleBetween(collidingEntity.position);
            const playerHealthComponent = collidingEntity.getComponent("health")!;

            const healthBeforeAttack = playerHealthComponent.getHealth();

            // Damage and knock back the player
            playerHealthComponent.damage(Zombie.ATTACK_DAMAGE, Zombie.ATTACK_KNOCKBACK, hitDirection, this, "zombie");
            playerHealthComponent.addLocalInvulnerabilityHash("zombie", 0.3);

            // Push the zombie away from the entity
            if (playerHealthComponent.getHealth() < healthBeforeAttack) {
               this.getComponent("health")!.applyKnockback(Zombie.ATTACK_SELF_KNOCKBACK, hitDirection + Math.PI);
            }
         }
      });

      this.createEvent("hurt", (_1, _2, _knockback: number, hitDirection: number | null): void => {
         this.createBloodPoolParticle();

         if (hitDirection !== null) {
            for (let i = 0; i < 10; i++) {
               this.createBloodParticle(hitDirection);
            }
         }
      });

      if (Math.random() < 0.1) {
         itemCreationComponent.createItemOnDeath("eyeball", 1, true);
      }
   }

   public tick(): void {
      super.tick();

      // If day time, ignite
      if (Board.time >= 6 && Board.time < 18) {
         // Ignite randomly or stay on fire if already on fire
         if (super.hasStatusEffect("fire") || Math.random() < Zombie.SPONTANEOUS_COMBUSTION_CHANCE / SETTINGS.TPS) {
            super.applyStatusEffect("fire", 5);
         }
      }

      // Create footsteps
      if (this.acceleration !== null && this.velocity !== null && SERVER.tickIntervalHasPassed(0.3)) {
         this.createFootprintParticle(this.numFootstepsTaken, 20, 1, 4);

         this.numFootstepsTaken++;
      }
   }

   public getClientArgs(): [zombieType: number] {
      return [this.zombieType];
   }
}

export default Zombie;