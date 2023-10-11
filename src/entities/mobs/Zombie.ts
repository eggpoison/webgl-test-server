import { ArmourItemInfo, ITEM_INFO_RECORD, ItemType, PlayerCauseOfDeath, Point, SETTINGS, StatusEffect, randFloat } from "webgl-test-shared";
import Board from "../../Board";
import HealthComponent from "../../entity-components/HealthComponent";
import CircularHitbox from "../../hitboxes/CircularHitbox";
import Entity from "../Entity";
import Mob from "./Mob";
import WanderAI from "../../mob-ai/WanderAI";
import HerdAI from "../../mob-ai/HerdAI";
import ChaseAI from "../../mob-ai/ChaseAI";
import ItemCreationComponent from "../../entity-components/ItemCreationComponent";
import TribeMember from "../tribes/TribeMember";

class Zombie extends Mob {
   /** Chance for a zombie to spontaneously combust every second */
   private static readonly SPONTANEOUS_COMBUSTION_CHANCE = 0.5;

   private static readonly MAX_HEALTH = 20;

   private static readonly ATTACK_PURSUE_TIME = 5;

   private static readonly ATTACK_DAMAGE = 2;
   private static readonly ATTACK_KNOCKBACK = 150;
   private static readonly ATTACK_SELF_KNOCKBACK = 100;

   /** The type of the zombie, 0-3 */
   private readonly zombieType: number;

   // Stores the ids of all entities which have recently attacked the zombie
   private readonly attackingEntities: Record<number, number> = {};

   constructor(position: Point, isGolden: boolean = false) {
      const itemCreationComponent = new ItemCreationComponent(48);
      
      super(position, {
         health: new HealthComponent(Zombie.MAX_HEALTH, false),
         item_creation: itemCreationComponent
      }, "zombie", 270);

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
         entityIsChased: (entity: Entity) => {
            return this.shouldAttackEntity(entity);
         }
      }));

      const hitbox = new CircularHitbox();
      hitbox.radius = 32;
      this.addHitbox(hitbox);
      
      if (isGolden) {
         this.zombieType = 3;
      } else {
         this.zombieType = Math.floor(Math.random() * 3);
      }

      this.rotation = 2 * Math.PI * Math.random();

      // Hurt enemies on collision
      this.createEvent("during_entity_collision", (collidingEntity: Entity) => {
         if (collidingEntity.type === "player" || this.shouldAttackEntity(collidingEntity)) {
            const hitDirection = this.position.calculateAngleBetween(collidingEntity.position);
            const playerHealthComponent = collidingEntity.forceGetComponent("health");

            const healthBeforeAttack = playerHealthComponent.getHealth();

            // Damage and knock back the player
            playerHealthComponent.damage(Zombie.ATTACK_DAMAGE, Zombie.ATTACK_KNOCKBACK, hitDirection, this, PlayerCauseOfDeath.zombie, 0, "zombie");
            playerHealthComponent.addLocalInvulnerabilityHash("zombie", 0.3);

            // Push the zombie away from the entity
            if (playerHealthComponent.getHealth() < healthBeforeAttack) {
               this.forceGetComponent("health").applyKnockback(Zombie.ATTACK_SELF_KNOCKBACK, hitDirection + Math.PI);
            }
         }
      });

      this.createEvent("hurt", (_, attackingEntity: Entity | null): void => {
         if (attackingEntity !== null) {
            this.attackingEntities[attackingEntity.id] = Zombie.ATTACK_PURSUE_TIME;
         }
      });

      if (Math.random() < 0.1) {
         itemCreationComponent.createItemOnDeath(ItemType.eyeball, 1, true);
      }
   }

   private shouldAttackEntity(entity: Entity): boolean {
      // If the entity is attacking the zombie, attack back
      if (this.attackingEntities.hasOwnProperty(entity.id)) {
         return true;
      }

      // Attack tribe members, but only if they aren't wearing a meat suit
      if (entity.type === "player" || entity.type === "tribesman") {
         const armourInventory = (entity as TribeMember).forceGetComponent("inventory").getInventory("armourSlot");
         if (armourInventory.itemSlots.hasOwnProperty(1)) {
            if (armourInventory.itemSlots[1].type === ItemType.meat_suit) {
               return false;
            }
         }
         return true;
      }

      return entity.type === "tribe_totem" || entity.type === "tribe_hut" || entity.type === "barrel";
   }

   public tick(): void {
      super.tick();

      // Update attacking entities
      for (const id of Object.keys(this.attackingEntities) as unknown as ReadonlyArray<number>) {
         this.attackingEntities[id] -= 1 / SETTINGS.TPS;
         if (this.attackingEntities[id] <= 0) {
            delete this.attackingEntities[id];
         }
      }

      // If day time, ignite
      if (Board.time >= 6 && Board.time < 18) {
         // Ignite randomly or stay on fire if already on fire
         if (super.hasStatusEffect(StatusEffect.burning) || Math.random() < Zombie.SPONTANEOUS_COMBUSTION_CHANCE / SETTINGS.TPS) {
            super.applyStatusEffect(StatusEffect.burning, 5);
         }
      }
   }

   public getClientArgs(): [zombieType: number] {
      return [this.zombieType];
   }
}

export default Zombie;