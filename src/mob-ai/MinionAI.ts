import { MobAIType } from "../mob-ai-types";
import AI from "./AI";
import { ItemType, PlayerCauseOfDeath, SETTINGS, TileType } from "webgl-test-shared";
import Entity from "../entities/Entity";
import Mob from "../entities/mobs/Mob";
import { customTickIntervalHasPassed } from "../Board";
import Fish from "../entities/mobs/Fish";

interface MinionAIParams {
   readonly acceleration: number;
   readonly terminalVelocity: number;
}

class MinionAI extends AI {
   private static readonly LUNGE_FORCE = 200;
   private static readonly LUNGE_INTERVAL = 1;
   private static readonly ATTACK_DAMAGE = 2;
   
   public readonly type = MobAIType.minion;

   private readonly acceleration: number;
   private readonly terminalVelocity: number;

   private leader!: Entity;
   private attackTarget: Entity | null = null;

   constructor(mob: Mob, aiParams: MinionAIParams) {
      super(mob);

      this.acceleration = aiParams.acceleration;
      this.terminalVelocity = aiParams.terminalVelocity;

      this.mob.createEvent("during_entity_collision", (collidingEntity: Entity) => {
         if (collidingEntity === this.attackTarget) {
            const healthComponent = collidingEntity.getComponent("health");
            if (healthComponent !== null) {
               const hitDirection = this.mob.position.calculateAngleBetween(collidingEntity.position);
               healthComponent.damage(MinionAI.ATTACK_DAMAGE, 100, hitDirection, this.mob, PlayerCauseOfDeath.fish, 0);
            }
         }
      });
   }

   public tick(): void {
      if (this.attackTarget === null) {
         // Follow leader
         this.move(this.mob.position.calculateAngleBetween(this.leader.position));
      } else {
         // Attack the target
         this.move(this.mob.position.calculateAngleBetween(this.attackTarget.position));
      }
   }

   private move(direction: number): void {
      if (this.mob.tile.type === TileType.water) {
         // 
         // Swim on water
         // 

         this.mob.acceleration.x = this.acceleration * Math.sin(direction);
         this.mob.acceleration.y = this.acceleration * Math.cos(direction);
         this.mob.terminalVelocity = this.terminalVelocity;
         this.mob.rotation = direction;
      } else {
         // 
         // Lunge on land
         // 

         this.mob.acceleration.x = 0;
         this.mob.acceleration.y = 0;
         this.mob.terminalVelocity = 0;

         if (customTickIntervalHasPassed((this.mob as Fish).secondsOutOfWater * SETTINGS.TPS, MinionAI.LUNGE_INTERVAL)) {
            this.mob.velocity.x += MinionAI.LUNGE_FORCE * Math.sin(direction);
            this.mob.velocity.y += MinionAI.LUNGE_FORCE * Math.cos(direction);
            this.mob.rotation = direction;
         }
      }
   }

   // This function is anonymous so that we preserve the value of 'this' in callbacks
   private onLeaderHurt = (_damage: number, attackingEntity: Entity | null): void => {
      if (attackingEntity !== null) {
         this.attackTarget = attackingEntity;
      }
   }

   public onRefresh(): void {
      // Look for a leader
      for (const entity of this.mob.visibleEntities) {
         if (entity.type === "player" || entity.type === "tribesman") {
            const armourInventory = entity.forceGetComponent("inventory").getInventory("armourSlot");
            if (armourInventory.itemSlots.hasOwnProperty(1) && armourInventory.itemSlots[1].type === ItemType.fishlord_suit) {
               // New leader
               if (entity !== this.leader) {
                  if (this.leader !== null && typeof this.leader !== "undefined") {
                     this.leader.removeEvent("hurt", this.onLeaderHurt);
                  }

                  entity.createEvent("hurt", this.onLeaderHurt);
               
                  this.leader = entity;
               }

               break;
            }
         }
      }
   }
   
   public canSwitch(): boolean {
      // Look for any tribe members wearing a fishlord suit
      for (const entity of this.mob.visibleEntities) {
         if (entity.type === "player" || entity.type === "tribesman") {
            const armourInventory = entity.forceGetComponent("inventory").getInventory("armourSlot");
            if (armourInventory.itemSlots.hasOwnProperty(1) && armourInventory.itemSlots[1].type === ItemType.fishlord_suit) {
               return true;
            }
         }
      }

      return false;
   }
}

export default MinionAI;