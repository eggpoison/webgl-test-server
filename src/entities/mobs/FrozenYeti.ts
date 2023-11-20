import { COLLISION_BITS, DEFAULT_COLLISION_MASK, EntityTypeConst, FrozenYetiAttackType, GameObjectDebugData, ItemType, PlayerCauseOfDeath, Point, ProjectileType, SETTINGS, SnowballSize, StatusEffectConst, TileTypeConst, angle, randFloat, randInt, randItem } from "webgl-test-shared";
import HealthComponent from "../../entity-components/HealthComponent";
import ItemCreationComponent from "../../entity-components/ItemCreationComponent";
import Mob from "./Mob";
import CircularHitbox from "../../hitboxes/CircularHitbox";
import Entity from "../Entity";
import Board from "../../Board";
import Snowball from "../Snowball";
import { entityIsInVisionRange, getAngleDifference, getEntitiesInVisionRange, getPositionRadialTiles } from "../../ai-shared";
import Projectile from "../../Projectile";
import Tile from "../../Tile";
import ItemConsumeAI from "../../mob-ai/ItemConsumeAI";
import HungerComponent from "../../entity-components/HungerComponent";

interface TargetInfo {
   damageDealtToSelf: number;
   timeSinceLastAggro: number;
}

interface RockSpikeInfo {
   readonly positionX: number;
   readonly positionY: number;
   readonly size: number;
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

   private static readonly SNOWBALL_THROW_SPEED = [590, 750] as const;

   private static readonly GLOBAL_ATTACK_COOLDOWN = 1.25;
   private static readonly BITE_COOLDOWN = 30;
   private static readonly SNOWBALL_THROW_COOLDOWN = 10;
   private static readonly ROAR_COOLDOWN = 100;
   private static readonly STOMP_COOLDOWN = 100;

   private static readonly STOMP_START_OFFSET = 40;
   private static readonly ROCK_SPIKE_HITBOX_SIZES = [12 * 2, 16 * 2, 20 * 2];
   private static readonly ROCK_SPIKE_MASSES = [1, 1.75, 2.5];

   private static readonly SNOWBALL_THROW_OFFSET = 150;
   private static readonly BITE_ATTACK_OFFSET = 140;
   private static readonly BITE_ATTACK_RANGE = 35;

   private static readonly ROAR_ARC = Math.PI / 6;
   private static readonly ROAR_REACH = 450;

   private static readonly SLOW_TERMINAL_VELOCITY = 100;
   private static readonly SLOW_ACCELERATION = 100;

   private static readonly TERMINAL_VELOCITY = 150;
   private static readonly ACCELERATION = 150;

   private static readonly TARGET_ENTITY_FORGET_TIME = 10;

   public mass = 5;

   private readonly attackingEntities: Record<number, TargetInfo> = {};

   private attackType = FrozenYetiAttackType.none;
   private attackStage = 0;
   private stageProgress = 0;

   private globalAttackCooldownTimer = FrozenYeti.GLOBAL_ATTACK_COOLDOWN;
   private snowballThrowCooldownTimer = FrozenYeti.SNOWBALL_THROW_COOLDOWN;
   private roarCooldownTimer = FrozenYeti.ROAR_COOLDOWN;
   private biteCooldownTimer = FrozenYeti.BITE_COOLDOWN;
   private stompCooldownTimer = FrozenYeti.STOMP_COOLDOWN;

   private rockSpikeInfoArray = new Array<RockSpikeInfo>();

   private lastTargetPosition: Point | null = null;

   protected targetPosition: Point | null = null;

   public readonly collisionBit = COLLISION_BITS.other;
   public readonly collisionMask = DEFAULT_COLLISION_MASK;

   constructor(position: Point) {
      super(position, {
         health: new HealthComponent(FrozenYeti.MAX_HEALTH, false),
         item_creation: new ItemCreationComponent(FrozenYeti.SIZE / 2),
         hunger: new HungerComponent(randFloat(0, 25), randFloat(1, 2) * 100)
      }, EntityTypeConst.frozen_yeti, FrozenYeti.VISION_RANGE);

      this.forceGetComponent("item_creation").createItemOnDeath(ItemType.deepfrost_heart, randInt(2, 3), true);
      this.forceGetComponent("item_creation").createItemOnDeath(ItemType.yeti_hide, randInt(5, 7), true);
      this.forceGetComponent("item_creation").createItemOnDeath(ItemType.raw_beef, randInt(13, 18), false);

      const bodyHitbox = new CircularHitbox(FrozenYeti.SIZE / 2, 0, 0);
      this.addHitbox(bodyHitbox);

      const headHitbox = new CircularHitbox(FrozenYeti.HEAD_HITBOX_SIZE / 2, 0, FrozenYeti.HEAD_DISTANCE);
      this.addHitbox(headHitbox);

      // Paw hitboxes
      for (let i = 0; i < 2; i++) {
         const pawDirection = FrozenYeti.PAW_RESTING_ANGLE * (i === 0 ? -1 : 1);
         const hitbox = new CircularHitbox(FrozenYeti.PAW_SIZE / 2, FrozenYeti.PAW_OFFSET * Math.sin(pawDirection), FrozenYeti.PAW_OFFSET * Math.cos(pawDirection));
         this.addHitbox(hitbox);
      }

      this.addAI(
         new ItemConsumeAI(this, {
            terminalVelocity: FrozenYeti.TERMINAL_VELOCITY,
            acceleration: FrozenYeti.ACCELERATION,
            itemTargets: new Set([ItemType.raw_beef])
         })
      );

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
         if (this.attackingEntities.hasOwnProperty(attackingEntity.id)) {
            this.attackingEntities[attackingEntity.id].damageDealtToSelf += damage;
            this.attackingEntities[attackingEntity.id].timeSinceLastAggro += 0;
         } else {
            this.attackingEntities[attackingEntity.id] = {
               damageDealtToSelf: damage,
               timeSinceLastAggro: 0
            };
         }
      });
   }

   public tick(): void {
      super.tick();

      if (this.currentAI !== null) {
         return;
      }

      // Remove targets which are dead or have been out of aggro long enough
      // @Speed: Remove calls to Object.keys, Number, and hasOwnProperty
      for (const _targetID of Object.keys(this.attackingEntities)) {
         const targetID = Number(_targetID);

         if (!Board.entities.hasOwnProperty(targetID)) {
            delete this.attackingEntities[targetID];
            continue;
         }

         this.attackingEntities[targetID].timeSinceLastAggro += 1 / SETTINGS.TPS;
         if (this.attackingEntities[targetID].timeSinceLastAggro >= FrozenYeti.TARGET_ENTITY_FORGET_TIME) {
            delete this.attackingEntities[targetID];
         }
      }

      const targets = this.findTargets();
      if (targets.length === 0 && this.attackType === FrozenYetiAttackType.none) {
         this.attackType = FrozenYetiAttackType.none;
         this.attackStage = 0;
         this.stageProgress = 0;

         this.globalAttackCooldownTimer = FrozenYeti.GLOBAL_ATTACK_COOLDOWN;
         this.biteCooldownTimer = FrozenYeti.BITE_COOLDOWN;
         this.snowballThrowCooldownTimer = FrozenYeti.SNOWBALL_THROW_COOLDOWN;
         this.roarCooldownTimer = FrozenYeti.ROAR_COOLDOWN;
         this.stompCooldownTimer = FrozenYeti.STOMP_COOLDOWN;

         // @Cleanup: Copy and pasted from Wander AI
         if (this.targetPosition !== null) {
            // Check if reached target position
            if (this.hasReachedTargetPosition()) {
               this.targetPosition = null;
               this.acceleration.x = 0;
               this.acceleration.y = 0;
            }
         } else {
            // No target position

            // Look for new target position
            if (this.velocity.x === 0 && this.velocity.y === 0 && Math.random() < 0.4 / SETTINGS.TPS) {
               const wanderTiles = getPositionRadialTiles(this.position, this.visionRange);
               if (wanderTiles.length === 0) {
                  this.acceleration.x = 0;
                  this.acceleration.y = 0;
                  this.lastTargetPosition = null;
                  return;
               }

               const validWanderTiles = new Array<Tile>();
               for (const tile of wanderTiles) {
                  if (tile.type === TileTypeConst.fimbultur) {
                     validWanderTiles.push(tile);
                  }
               }
         
               // If no valid positions can be found then move to a random position
               if (validWanderTiles.length === 0) {
                  const tile = randItem(wanderTiles);
                  const position = new Point((tile.x + Math.random()) * SETTINGS.TILE_SIZE, (tile.y + Math.random()) * SETTINGS.TILE_SIZE);
                  this.targetPosition = position;
         
                  const direction = angle(position.x - this.position.x, position.y - this.position.y);
                  this.acceleration.x = FrozenYeti.SLOW_ACCELERATION * Math.sin(direction);
                  this.acceleration.y = FrozenYeti.SLOW_ACCELERATION * Math.cos(direction);
                  this.terminalVelocity = FrozenYeti.SLOW_TERMINAL_VELOCITY;
                  this.rotation = direction;

                  return;
               }

               // Look randomly through the array for a target position
               const indexes = validWanderTiles.map((_, i) => i);
               while (indexes.length > 0) {
                  const tempIdx = randInt(0, indexes.length - 1);
                  const idx = indexes[tempIdx];
                  indexes.splice(tempIdx, 1);
      
                  const tile = validWanderTiles[idx];
      
                  const wanderPositionX = (tile.x + Math.random()) * SETTINGS.TILE_SIZE;
                  const wanderPositionY = (tile.y + Math.random()) * SETTINGS.TILE_SIZE;
                  this.targetPosition = new Point(wanderPositionX, wanderPositionY);
                  
                  const direction = angle(wanderPositionX - this.position.x, wanderPositionY - this.position.y);
                  this.acceleration.x = FrozenYeti.SLOW_ACCELERATION * Math.sin(direction);
                  this.acceleration.y = FrozenYeti.SLOW_ACCELERATION * Math.cos(direction);
                  this.terminalVelocity = FrozenYeti.SLOW_TERMINAL_VELOCITY;
                  this.rotation = direction;
                  return;
               }
            } else {
               this.acceleration.x = 0;
               this.acceleration.y = 0;
            }
         }

         this.lastTargetPosition = null;

         return;
      }

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
      this.stompCooldownTimer -= 1 / SETTINGS.TPS;
      if (this.stompCooldownTimer < 0) {
         this.stompCooldownTimer = 0;
      }

      // If any target has dealt damage to the yeti, choose the target based on which one has dealt the most damage to it
      // Otherwise attack the closest target
      let target: Entity | null = null;
      if (Object.keys(this.attackingEntities).length === 0) {
         // Choose based on distance
         let minDist = Number.MAX_SAFE_INTEGER;
         for (const currentTarget of targets) {
            const distance = this.position.calculateDistanceBetween(currentTarget.position);
            if (distance < minDist) {
               minDist = distance;
               target = currentTarget;
            }
         }
      } else {
         let mostDamageDealt = -1;
         for (const currentTarget of targets) {
            if (this.attackingEntities.hasOwnProperty(currentTarget.id)) {
               const targetInfo = this.attackingEntities[currentTarget.id];
               if (targetInfo.damageDealtToSelf > mostDamageDealt) {
                  mostDamageDealt = targetInfo.damageDealtToSelf;
                  target = currentTarget;
               }
            }
         }
      }
      if (target !== null) {
         // @Speed: Garbage collection
         this.lastTargetPosition = target.position.copy();
      }

      let angleToTarget: number;
      if (target !== null) {
         angleToTarget = this.position.calculateAngleBetween(target.position);
      } else {
         angleToTarget = this.position.calculateAngleBetween(this.lastTargetPosition!);
      }
      if (angleToTarget < 0) {
         angleToTarget += 2 * Math.PI;
      }

      if (this.attackType === FrozenYetiAttackType.none && target !== null) {
         this.attackType = this.getAttackType(target, angleToTarget, targets.length);
      }
      switch (this.attackType) {
         case FrozenYetiAttackType.stomp: {
            this.terminalVelocity = 0;
            this.acceleration.x = 0;
            this.acceleration.y = 0;

            switch (this.attackStage) {
               // Windup
               case 0: {
                  if (this.stageProgress === 0) {
                     this.rockSpikeInfoArray = this.generateRockSpikeAttackInfo(targets);
                  }
                  
                  this.stageProgress += 0.75 / SETTINGS.TPS;
                  this.attemptToAdvanceStage();
                  if (this.stageProgress === 0) {
                     this.createRockSpikes();
                  }
                  break;
               }
               // Stomp
               case 1: {
                  this.stageProgress += 2 / SETTINGS.TPS;
                  this.attemptToAdvanceStage();
               }
               // Daze
               case 2: {
                  this.stageProgress += 2 / SETTINGS.TPS;
                  this.clearAttack();
                  if (this.stageProgress === 0) {
                     this.stompCooldownTimer = FrozenYeti.STOMP_COOLDOWN;
                     this.globalAttackCooldownTimer = FrozenYeti.GLOBAL_ATTACK_COOLDOWN;
                  }
               }
            }
            
            break;
         }
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

                  this.duringRoar(targets);
                  
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

   private hasReachedTargetPosition(): boolean {
      if (this.targetPosition === null || this.velocity === null) return false;

      const relativeTargetPosition = this.position.copy();
      relativeTargetPosition.subtract(this.targetPosition);

      const dotProduct = this.velocity.calculateDotProduct(relativeTargetPosition);
      return dotProduct > 0;
   }

   private findTargets(): ReadonlyArray<Entity> {
      const targets = new Array<Entity>();
      for (const entity of this.visibleEntities) {
         targets.push(entity);
      }

      for (let i = 0; i < targets.length; i++) {
         const entity = targets[i];
         // Don't attack entities which aren't in the tundra or the entity is native to the tundra
         if (entity.tile.biomeName !== "tundra" || entity.type === EntityTypeConst.frozen_yeti || entity.type === EntityTypeConst.ice_spikes || entity.type === EntityTypeConst.snowball) {
            targets.splice(i, 1);
            i--;
         }
      }

      // Add attacking entities to targets
      for (const _targetID of Object.keys(this.attackingEntities)) {
         const entity = Board.entities[Number(_targetID)];
         if (targets.indexOf(entity) === -1) {
            targets.push(entity);
         }
      }

      return targets;
   }

   private getAttackType(target: Entity, angleToTarget: number, numTargets: number): FrozenYetiAttackType {
      if (this.globalAttackCooldownTimer > 0) {
         return FrozenYetiAttackType.none;
      }

      const angleDifference = getAngleDifference(angleToTarget, this.rotation);
      
      // Bite if target is in range and the yeti's mouth is close enough
      if (this.biteCooldownTimer === 0 && Math.abs(angleDifference) <= 0.7 && entityIsInVisionRange(this.position, FrozenYeti.BITE_RANGE, target)) {
         return FrozenYetiAttackType.bite;
      }

      // Stomp if two or more targets in range
      if (this.stompCooldownTimer === 0 && numTargets >= 2) {
         return FrozenYetiAttackType.stomp;
      }
      
      // Roar attack if mouth is close enough
      if (this.roarCooldownTimer === 0 && Math.abs(angleDifference) <= 0.5) {
         return FrozenYetiAttackType.roar;
      }

      // Snow throw attack if mouth is close enough
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
      for (let i = 0; i < 3; i++) {
         this.createSnowball(SnowballSize.large, this.rotation);
      }

      // Small snowballs
      for (let i = 0; i < 5; i++) {
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

            entity.applyStatusEffect(StatusEffectConst.freezing, 5 * SETTINGS.TPS);
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
               entity.applyStatusEffect(StatusEffectConst.bleeding, 5 * SETTINGS.TPS);
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
         if (collidingEntity === this || collidingEntity.type === EntityTypeConst.snowball) {
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

   /**
    * Stomp
    * @param targets Whomst to stomp
    */
   private generateRockSpikeAttackInfo(targets: ReadonlyArray<Entity>): Array<RockSpikeInfo> {
      // @Speed: Garbage collection

      const rockSpikeInfoArray = new Array<RockSpikeInfo>();
      
      const angles = new Array<number>();

      const numSequences = Math.min(targets.length, 3);
      const availableTargetIndexes = targets.map((_, i) => i);
      for (let i = 0; i < numSequences; i++) {
         const idx = Math.floor(Math.random() * availableTargetIndexes.length);
         const target = targets[availableTargetIndexes[idx]];
         availableTargetIndexes.splice(idx, 1);
         
         const direction = this.position.calculateAngleBetween(target.position);
         
         // Don't do sequence if too close to existing sequence
         let isValid = true;
         for (const angle of angles) {
            if (Math.abs(getAngleDifference(angle, direction)) <= Math.PI / 5) {
               isValid = false;
               break;
            }
         }
         if (!isValid) {
            continue;
         }
         
         const perpendicularDirection = direction + Math.PI / 2;
         angles.push(direction);

         // 
         // Main sequence
         // 
         
         const numMainSequenceNodes = randInt(4, 5);
         
         const startPositionX = this.position.x + (FrozenYeti.SIZE / 2 + FrozenYeti.STOMP_START_OFFSET) * Math.sin(direction);
         const startPositionY = this.position.y + (FrozenYeti.SIZE / 2 + FrozenYeti.STOMP_START_OFFSET) * Math.cos(direction);

         const spikePositions = new Array<Point>();
         const spikeSizes = new Array<number>();
         
         // Create main sequence spikes
         let totalOffset = 0;
         for (let i = 0; i < numMainSequenceNodes; i++) {
            let positionX = startPositionX + totalOffset * Math.sin(direction);
            let positionY = startPositionY + totalOffset * Math.cos(direction);
            totalOffset += randFloat(75, 110);

            // Add perpendicular offset
            const offsetMagnitude = randFloat(-25, 25) * Math.pow(i + 1, 0.75);
            positionX += offsetMagnitude * Math.sin(perpendicularDirection);
            positionY += offsetMagnitude * Math.cos(perpendicularDirection);

            const spawnPosition = new Point(positionX, positionY);
            const size = i <= numMainSequenceNodes / 2 ? 2 : 1;

            spikePositions.push(spawnPosition);
            spikeSizes.push(size);
            rockSpikeInfoArray.push({
               positionX: positionX,
               positionY: positionY,
               size: size
            });
         }

         // Create non-main-sequence spikes
         for (let i = 0; i < 15; i++) {
            const size = 0;
            
            const dist = Math.random();
            const offset = totalOffset * 1.5 * dist;

            let positionX = startPositionX + offset * Math.sin(direction);
            let positionY = startPositionY + offset * Math.cos(direction);

            // Perpendicular offset
            const offsetMagnitude = randFloat(-40, 40) * Math.pow(i + 1, 0.75);
            positionX += offsetMagnitude * Math.sin(perpendicularDirection);
            positionY += offsetMagnitude * Math.cos(perpendicularDirection);

            const position = new Point(positionX, positionY);

            // Make sure the position wouldn't collide with any other spikes
            let positionIsValid = true;
            let minDist = Number.MAX_SAFE_INTEGER;
            for (let i = 0; i < spikePositions.length; i++) {
               const otherPosition = spikePositions[i];
               const otherSize = spikeSizes[i];

               const distance = position.calculateDistanceBetween(otherPosition);
               if (distance <= FrozenYeti.ROCK_SPIKE_HITBOX_SIZES[size] / 2 + FrozenYeti.ROCK_SPIKE_HITBOX_SIZES[otherSize] / 2) {
                  positionIsValid = false;
                  break;
               }
               if (otherSize > 0 && distance < minDist) {
                  minDist = distance;
               }
            }
            // Don't create spike if would collide with existing spike or too far away from main sequence spike
            if (!positionIsValid || minDist > 100) {
               continue;
            }

            spikePositions.push(position);
            spikeSizes.push(size);
            rockSpikeInfoArray.push({
               positionX: positionX,
               positionY: positionY,
               size: size
            });
         }
      }

      return rockSpikeInfoArray;
   }

   private createRockSpikes(): void {
      for (const info of this.rockSpikeInfoArray) {
         const position = new Point(info.positionX, info.positionY);
         this.createSpikeProjectile(position, info.size);
      }
      this.rockSpikeInfoArray = [];
   }

   private createSpikeProjectile(spawnPosition: Point, size: number): void {
      const lifetime = randFloat(3.5, 4.5);
      const projectile = new Projectile(spawnPosition, ProjectileType.rockSpike, lifetime, [size, lifetime]);
      projectile.isStatic = true;
      projectile.rotation = 2 * Math.PI * Math.random();
      projectile.mass = FrozenYeti.ROCK_SPIKE_MASSES[size];

      const hitbox = new CircularHitbox(FrozenYeti.ROCK_SPIKE_HITBOX_SIZES[size], 0, 0);
      projectile.addHitbox(hitbox);

      projectile.createEvent("during_entity_collision", (collidingEntity: Entity) => {
         // Don't hurt the yeti which created the spike
         if (collidingEntity === this) {
            return;
         }
         
         // Damage the entity
         const healthComponent = collidingEntity.getComponent("health");
         if (healthComponent !== null) {
            const hitDirection = this.position.calculateAngleBetween(collidingEntity.position);
            healthComponent.damage(5, 200, hitDirection, null, PlayerCauseOfDeath.rock_spike, 0, "rock_spike");
            healthComponent.addLocalInvulnerabilityHash("rock_spike", 0.3);
         }
      });
   }

   public getClientArgs(): [attackType: FrozenYetiAttackType, attackStage: number, stageProgress: number, rockSpikePositions: Array<[number, number]>] {
      return [this.attackType, this.attackStage, this.stageProgress, this.rockSpikeInfoArray.map(info => [info.positionX, info.positionY])];
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