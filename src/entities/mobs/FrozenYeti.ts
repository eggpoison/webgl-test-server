import { FrozenYetiAttackType, GameObjectDebugData, ItemType, PlayerCauseOfDeath, Point, SETTINGS, SnowballSize, StatusEffect, Vector, angle, randFloat, randInt } from "webgl-test-shared";
import HealthComponent from "../../entity-components/HealthComponent";
import ItemCreationComponent from "../../entity-components/ItemCreationComponent";
import Mob from "./Mob";
import CircularHitbox from "../../hitboxes/CircularHitbox";
import Entity from "../Entity";
import Board from "../../Board";
import Snowball from "../Snowball";
import { entityIsInVisionRange, getAngleDifference, getEntitiesInVisionRange } from "../../ai-shared";

interface TargetInfo {
   damageDealtToSelf: number;
   timeSinceLastAggro: number;
}

class FrozenYeti extends Mob {
   private static readonly VISION_RANGE = 350;
   private static readonly BITE_RANGE = 150;
   
   private static readonly SIZE = 144;
   private static readonly HEAD_HITBOX_SIZE = 72;
   private static readonly HEAD_DISTANCE = 60;
   private static readonly PAW_SIZE = 32;
   private static readonly PAW_OFFSET = 80;
   private static readonly PAW_RESTING_ANGLE = Math.PI / 3.5;
   private static readonly PAW_HIGH_ANGLE = Math.PI / 6;

   private static readonly MAX_HEALTH = 250;

   private static readonly CONTACT_DAMAGE = 5;
   private static readonly CONTACT_KNOCKBACK = 250;

   private static readonly SNOWBALL_THROW_SPEED = [550, 650] as const;

   private static readonly GLOBAL_ATTACK_COOLDOWN = 2;
   private static readonly SNOWBALL_THROW_COOLDOWN = 1;
   private static readonly ROAR_COOLDOWN = 10;
   private static readonly BITE_COOLDOWN = 3;

   private static readonly SNOWBALL_THROW_OFFSET = 150;
   private static readonly BITE_ATTACK_OFFSET = 140;
   private static readonly BITE_ATTACK_RANGE = 35;

   private static readonly ROAR_ARC = Math.PI / 6;
   private static readonly ROAR_REACH = 450;

   private static readonly TERMINAL_VELOCITY = 150;
   private static readonly ACCELERATION = 150;

   public mass = 5;

   private readonly targets: Record<number, TargetInfo> = {};

   private attackType = FrozenYetiAttackType.none;
   private attackStage = 0;
   private stageProgress = 0;

   private globalAttackCooldownTimer = FrozenYeti.GLOBAL_ATTACK_COOLDOWN;
   private snowballThrowCooldownTimer = FrozenYeti.SNOWBALL_THROW_COOLDOWN;
   private roarCooldownTimer = FrozenYeti.ROAR_COOLDOWN;
   private biteCooldownTimer = FrozenYeti.BITE_COOLDOWN;

   constructor(position: Point) {
      super(position, {
         health: new HealthComponent(FrozenYeti.MAX_HEALTH, false),
         item_creation: new ItemCreationComponent(FrozenYeti.SIZE / 2)
      }, "frozen_yeti", FrozenYeti.VISION_RANGE);

      this.forceGetComponent("item_creation").createItemOnDeath(ItemType.deep_frost_heart, randInt(2, 3), true);
      this.forceGetComponent("item_creation").createItemOnDeath(ItemType.yeti_hide, randInt(5, 7), true);
      this.forceGetComponent("item_creation").createItemOnDeath(ItemType.raw_beef, randInt(13, 18), false);

      const bodyHitbox = new CircularHitbox();
      bodyHitbox.radius = FrozenYeti.SIZE / 2;
      this.addHitbox(bodyHitbox);

      const headHitbox = new CircularHitbox();
      headHitbox.radius = FrozenYeti.HEAD_HITBOX_SIZE / 2;
      headHitbox.offset = new Point(0, FrozenYeti.HEAD_DISTANCE);
      this.addHitbox(headHitbox);

      // Paw hitboxes
      for (let i = 0; i < 2; i++) {
         const hitbox = new CircularHitbox();
         hitbox.radius = FrozenYeti.PAW_SIZE / 2;
         hitbox.offset = Point.fromVectorForm(FrozenYeti.PAW_OFFSET, FrozenYeti.PAW_RESTING_ANGLE * (i === 0 ? -1 : 1));
         this.addHitbox(hitbox);
      }

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

      this.createEvent("hurt", (damage: number, attackingEntity: Entity | null) => {
         if (attackingEntity === null) {
            return;
         }

         // Update/create the entity's targetInfo record
         if (this.targets.hasOwnProperty(attackingEntity.id)) {
            this.targets[attackingEntity.id].damageDealtToSelf += damage;
            this.targets[attackingEntity.id].timeSinceLastAggro += 0;
         } else {
            this.targets[attackingEntity.id] = {
               damageDealtToSelf: damage,
               timeSinceLastAggro: 0
            };
         }
      });
   }

   public tick(): void {
      super.tick();

      this.globalAttackCooldownTimer -= 1 / SETTINGS.TPS;
      if (this.globalAttackCooldownTimer < 0) {
         this.globalAttackCooldownTimer = 0;
      }
      this.snowballThrowCooldownTimer -= 1 / SETTINGS.TPS;
      if (this.snowballThrowCooldownTimer < 0) {
         this.snowballThrowCooldownTimer = 0;
      }
      this.roarCooldownTimer -= 1 / SETTINGS.TPS;
      if (this.roarCooldownTimer < 0) {
         this.roarCooldownTimer = 0;
      }
      this.biteCooldownTimer -= 1 / SETTINGS.TPS;
      if (this.biteCooldownTimer < 0) {
         this.biteCooldownTimer = 0;
      }

      // Remove targets which are dead
      // @Speed: Remove calls to Object.keys, Number, and hasOwnProperty
      for (const _targetID of Object.keys(this.targets)) {
         const targetID = Number(_targetID);
         if (!Board.entities.hasOwnProperty(targetID)) {
            delete this.targets[targetID];
         }
      }
      
      const entitiesInVisionRange = getEntitiesInVisionRange(this.position.x, this.position.y, FrozenYeti.VISION_RANGE);

      // Remove self from entities in vision range
      for (let i = 0; i < entitiesInVisionRange.length; i++) {
         if (entitiesInVisionRange[i] === this) {
            entitiesInVisionRange.splice(i, 1);
            break;
         }
      }

      // Add entities in vision range to targets
      for (const entity of entitiesInVisionRange) {
         if (!this.targets.hasOwnProperty(entity.id)) {
            this.targets[entity.id] = {
               damageDealtToSelf: 0,
               timeSinceLastAggro: 0
            };
         } else {
            this.targets[entity.id].timeSinceLastAggro = 0;
         }
      }

      if (Object.keys(this.targets).length === 0) {
         this.attackType = FrozenYetiAttackType.none;
         return;
      }

      // Choose target based on which one has dealt the most damage to it
      let targetID!: number;
      let mostDamageDealt = -1;
      // @Speed
      for (const [_targetID, targetInfo] of Object.entries(this.targets)) {
         if (targetInfo.damageDealtToSelf > mostDamageDealt) {
            mostDamageDealt = targetInfo.damageDealtToSelf;
            targetID = Number(_targetID);
         }
      }
      if (!Board.entities.hasOwnProperty(targetID)) {
         throw new Error("Couldn't find target");
      }
      const target = Board.entities[targetID];

      let angleToTarget = this.position.calculateAngleBetween(target.position);
      if (angleToTarget < 0) {
         angleToTarget += Math.PI * 2;
      }

      if (this.attackType === FrozenYetiAttackType.none) {
         this.attackType = this.getAttackType(target, angleToTarget);
      }
      switch (this.attackType) {
         case FrozenYetiAttackType.snowThrow: {
            this.terminalVelocity = 0;
            this.acceleration.x = 0;
            this.acceleration.y = 0;
            
            switch (this.attackStage) {
               // Windup
               case 0: {
                  this.turn(angleToTarget, 0.9);
                  
                  this.stageProgress += 0.55 / SETTINGS.TPS;
                  this.attemptToAdvanceStage();
                  break;
               }
               // Throw
               case 1: {
                  this.stageProgress += 3 / SETTINGS.TPS;
                  this.attemptToAdvanceStage();
                  if (this.stageProgress === 0) {
                     this.throwSnow();
                  }
                  break;
               }
               // Wind down
               case 2: {
                  this.stageProgress += 2 / SETTINGS.TPS;
                  this.clearAttack();
                  if (this.stageProgress === 0) {
                     this.snowballThrowCooldownTimer = FrozenYeti.SNOWBALL_THROW_COOLDOWN
                     this.globalAttackCooldownTimer = FrozenYeti.GLOBAL_ATTACK_COOLDOWN;
                  }
                  break;
               }
            }
            
            break;
         }
         case FrozenYetiAttackType.roar: {
            this.terminalVelocity = 0;
            this.acceleration.x = 0;
            this.acceleration.y = 0;

            switch (this.attackStage) {
               // Windup
               case 0: {
                  // Track target
                  this.turn(angleToTarget, 0.9);

                  this.stageProgress += 0.5 / SETTINGS.TPS;
                  this.attemptToAdvanceStage();
                  break;
               }
               // Roar attack
               case 1: {
                  // Track target
                  this.turn(angleToTarget, 0.35);

                  this.duringRoar(entitiesInVisionRange);
                  
                  this.stageProgress += 0.5 / SETTINGS.TPS;
                  this.clearAttack();
                  if (this.stageProgress === 0) {
                     this.roarCooldownTimer = FrozenYeti.ROAR_COOLDOWN;
                     this.globalAttackCooldownTimer = FrozenYeti.GLOBAL_ATTACK_COOLDOWN;
                  }
                  break;
               }
            }

            break;
         }
         case FrozenYetiAttackType.bite: {
            switch (this.attackStage) {
               // Charge
               case 0: {
                  // Move towards the target
                  this.terminalVelocity = 0;
                  this.acceleration.x = 0;
                  this.acceleration.y = 0;
                  this.turn(angleToTarget, 1.3);

                  this.stageProgress += 1.15 / SETTINGS.TPS;
                  this.attemptToAdvanceStage();
                  break;
               }
               // Lunge
               case 1: {
                  this.terminalVelocity = FrozenYeti.TERMINAL_VELOCITY;
                  this.acceleration.x = FrozenYeti.ACCELERATION * Math.sin(angleToTarget);
                  this.acceleration.y = FrozenYeti.ACCELERATION * Math.cos(angleToTarget);

                  // Lunge forwards at the beginning of this stage
                  if (this.stageProgress === 0) {
                     this.velocity.x += 450 * Math.sin(this.rotation);
                     this.velocity.y += 450 * Math.cos(this.rotation);
                  }

                  this.stageProgress += 2 / SETTINGS.TPS;
                  this.attemptToAdvanceStage();
                  if (this.stageProgress === 0) {
                     this.biteCooldownTimer = FrozenYeti.BITE_COOLDOWN;
                     this.globalAttackCooldownTimer = FrozenYeti.GLOBAL_ATTACK_COOLDOWN;
                     this.doBiteAttack(angleToTarget);
                  }
                  break;
               }
               // Wind-down
               case 2: {
                  this.terminalVelocity = FrozenYeti.TERMINAL_VELOCITY;
                  this.acceleration.x = FrozenYeti.ACCELERATION * Math.sin(angleToTarget);
                  this.acceleration.y = FrozenYeti.ACCELERATION * Math.cos(angleToTarget);
                  this.turn(angleToTarget, 1.3);

                  this.stageProgress += 2.5 / SETTINGS.TPS;
                  this.clearAttack();
               }
            }

            break;
         }
         case FrozenYetiAttackType.none: {
            // Move towards the target
            this.turn(angleToTarget, Math.PI);
            this.terminalVelocity = FrozenYeti.TERMINAL_VELOCITY;
            this.acceleration.x = FrozenYeti.ACCELERATION * Math.sin(angleToTarget);
            this.acceleration.y = FrozenYeti.ACCELERATION * Math.cos(angleToTarget);
            
            break;
         }
      }
   }

   private getAttackType(target: Entity, angleToTarget: number): FrozenYetiAttackType {
      if (this.globalAttackCooldownTimer > 0) {
         return FrozenYetiAttackType.none;
      }

      const angleDifference = getAngleDifference(angleToTarget, this.rotation);
      
      // Bite if target is in range and the yeti's mouth is close enough
      if (this.biteCooldownTimer === 0 && entityIsInVisionRange(this.position, FrozenYeti.BITE_RANGE, target)) {
         if (Math.abs(angleDifference) <= 0.7) {
            return FrozenYetiAttackType.bite;
         }
      }
      
      // Roar attack
      if (this.roarCooldownTimer === 0 && Math.abs(angleDifference) <= 0.5) {
         return FrozenYetiAttackType.roar;
      }

      // Snow throw attack
      if (this.snowballThrowCooldownTimer === 0 && Math.abs(angleDifference) <= 0.5) {
         return FrozenYetiAttackType.snowThrow;
      }

      return FrozenYetiAttackType.none;
   }

   private attemptToAdvanceStage(): void {
      if (this.stageProgress >= 1) {
         this.attackStage++;
         this.stageProgress = 0;
      }
   }

   private clearAttack(): void {
      if (this.stageProgress >= 1) {
         this.stageProgress = 0;
         this.attackStage = 0;
         this.attackType = FrozenYetiAttackType.none;
      }
   }

   private throwSnow(): void {
      // Large snowballs
      for (let i = 0; i < 2; i++) {
         this.createSnowball(SnowballSize.large, this.rotation);
      }

      // Small snowballs
      for (let i = 0; i < 3; i++) {
         this.createSnowball(SnowballSize.small, this.rotation);
      }

      // Kickback
      this.velocity.x += 50 * Math.sin(this.rotation + Math.PI);
      this.velocity.y += 50 * Math.cos(this.rotation + Math.PI);
   }

   private duringRoar(entitiesInVisionRange: ReadonlyArray<Entity>): void {
      for (const entity of entitiesInVisionRange) {
         // Make sure the entity is in range
         if (this.position.calculateDistanceBetween(entity.position) > FrozenYeti.ROAR_REACH) {
            continue;
         }
         
         // Check if the entity is within the arc range of the attack
         const angle = this.position.calculateAngleBetween(entity.position);
         const angleDifference = getAngleDifference(this.rotation, angle);
         if (Math.abs(angleDifference) <= FrozenYeti.ROAR_ARC / 2) {
            entity.velocity.x += 50 * Math.sin(angle);
            entity.velocity.y += 50 * Math.cos(angle);

            entity.applyStatusEffect(StatusEffect.freezing, 5);
         }
      }
   }

   private doBiteAttack(angleToTarget: number): void {
      const x = this.position.x + FrozenYeti.BITE_ATTACK_OFFSET * Math.sin(this.rotation);
      const y = this.position.y + FrozenYeti.BITE_ATTACK_OFFSET * Math.cos(this.rotation);
      const hitEntities = getEntitiesInVisionRange(x, y, FrozenYeti.BITE_ATTACK_RANGE);
      for (const entity of hitEntities) {
         if (entity !== this) {
            const healthComponent = entity.getComponent("health");
            if (healthComponent !== null) {
               healthComponent.damage(3, 200, angleToTarget, this, PlayerCauseOfDeath.frozen_yeti, 0);
               entity.applyStatusEffect(StatusEffect.bleeding, 5);
            }
         }
      }
   }

   private createSnowball(size: SnowballSize, throwAngle: number): void {
      const angle = throwAngle + randFloat(-1, 1);
      
      const position = this.position.copy();
      position.x += FrozenYeti.SNOWBALL_THROW_OFFSET * Math.sin(angle);
      position.y += FrozenYeti.SNOWBALL_THROW_OFFSET * Math.cos(angle);

      const snowball = new Snowball(position, size);

      const velocityMagnitude = randFloat(FrozenYeti.SNOWBALL_THROW_SPEED[0], FrozenYeti.SNOWBALL_THROW_SPEED[1]);
      snowball.velocity.x = velocityMagnitude * Math.sin(angle);
      snowball.velocity.y = velocityMagnitude * Math.cos(angle);

      snowball.createEvent("during_entity_collision", (collidingEntity: Entity) => {
         // Don't let the yeti damage itself or other snowballs
         if (collidingEntity === this || collidingEntity.type === "snowball") {
            return;
         }
         
         if (!snowball.canDamage) {
            return;
         }

         const healthComponent = collidingEntity.getComponent("health");
         if (healthComponent !== null) {
            const hitDirection = snowball.position.calculateAngleBetween(collidingEntity.position);
            healthComponent.damage(4, 100, hitDirection, null, PlayerCauseOfDeath.snowball, 0);
            healthComponent.addLocalInvulnerabilityHash("snowball", 0.3);
         }
      });
   }

   public getClientArgs(): [attackType: FrozenYetiAttackType, attackStage: number, stageProgress: number] {
      return [this.attackType, this.attackStage, this.stageProgress];
   }

   public getDebugData(): GameObjectDebugData {
      const debugData = super.getDebugData();

      debugData.circles.push({
         radius: FrozenYeti.VISION_RANGE,
         colour: [1, 0, 1],
         thickness: 2
      });
      debugData.circles.push({
         radius: FrozenYeti.BITE_RANGE,
         colour: [1, 0, 0],
         thickness: 2
      });

      return debugData;
   }
}

export default FrozenYeti;