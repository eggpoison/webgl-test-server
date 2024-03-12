import { COLLISION_BITS, DEFAULT_COLLISION_MASK, IEntityType, IceSpikesComponentData, ItemType, PlayerCauseOfDeath, Point, SettingsConst, StatusEffectConst, randFloat, randInt } from "webgl-test-shared";
import Entity from "../../Entity";
import CircularHitbox from "../../hitboxes/CircularHitbox";
import { HealthComponentArray, IceSpikesComponentArray } from "../../components/ComponentArray";
import { HealthComponent, addLocalInvulnerabilityHash, canDamageEntity, damageEntity } from "../../components/HealthComponent";
import { StatusEffectComponent, StatusEffectComponentArray, applyStatusEffect } from "../../components/StatusEffectComponent";
import { createIceShard } from "../projectiles/ice-shards";
import { SERVER } from "../../server";
import { IceSpikesComponent } from "../../components/IceSpikesComponent";
import Board from "../../Board";
import { createItemsOverEntity } from "../../entity-shared";
import { applyKnockback } from "../../components/PhysicsComponent";

const ICE_SPIKE_RADIUS = 40;

const TICKS_TO_GROW = 1/5 * SettingsConst.TPS;
const GROWTH_TICK_CHANCE = 0.5;
const GROWTH_OFFSET = 60;

export function createIceSpikes(position: Point, rootIceSpike?: Entity): Entity {
   const iceSpikes = new Entity(position, IEntityType.iceSpikes, COLLISION_BITS.iceSpikes, DEFAULT_COLLISION_MASK & ~COLLISION_BITS.iceSpikes);
   iceSpikes.rotation = 2 * Math.PI * Math.random();

   const hitbox = new CircularHitbox(iceSpikes, 1, 0, 0, ICE_SPIKE_RADIUS);
   iceSpikes.addHitbox(hitbox);

   HealthComponentArray.addComponent(iceSpikes, new HealthComponent(5));
   StatusEffectComponentArray.addComponent(iceSpikes, new StatusEffectComponent(StatusEffectConst.poisoned | StatusEffectConst.freezing));
   IceSpikesComponentArray.addComponent(iceSpikes, new IceSpikesComponent(rootIceSpike || iceSpikes));

   return iceSpikes;
}

const canGrow = (iceSpikesComponent: IceSpikesComponent): boolean => {
   if (!Board.entityRecord.hasOwnProperty(iceSpikesComponent.rootIceSpike.id)) {
      return false;
   }
   
   const rootIceSpikesComponent = IceSpikesComponentArray.getComponent(iceSpikesComponent.rootIceSpike.id);
   return rootIceSpikesComponent.numChildrenIceSpikes < rootIceSpikesComponent.maxChildren;
}

const grow = (iceSpikes: Entity): void => {
   // @Speed: Garbage collection

   // Calculate the spawn position for the new ice spikes
   const position = iceSpikes.position.copy();
   const offsetDirection = 2 * Math.PI * Math.random();
   position.x += GROWTH_OFFSET * Math.sin(offsetDirection);
   position.y += GROWTH_OFFSET * Math.cos(offsetDirection);

   // Don't grow outside the board
   if (!Board.positionIsInBoard(position.x, position.y)) {
      return;
   }

   // Only grow into tundra
   const tile = Board.getTileAtPosition(position);
   if (tile.biomeName !== "tundra") {
      return;
   }

   const minDistanceToEntity = Board.distanceToClosestEntity(position);
   if (minDistanceToEntity >= 40) {
      const iceSpikesComponent = IceSpikesComponentArray.getComponent(iceSpikes.id);
      createIceSpikes(position, iceSpikesComponent.rootIceSpike);
      
      const rootIceSpikesComponent = IceSpikesComponentArray.getComponent(iceSpikesComponent.rootIceSpike.id);
      rootIceSpikesComponent.numChildrenIceSpikes++;
   }
}

export function tickIceSpikes(iceSpikes: Entity): void {
   const iceSpikesComponent = IceSpikesComponentArray.getComponent(iceSpikes.id);

   if (canGrow(iceSpikesComponent) && Math.random() < GROWTH_TICK_CHANCE / SettingsConst.TPS) {
      iceSpikesComponent.iceSpikeGrowProgressTicks++;
      if (iceSpikesComponent.iceSpikeGrowProgressTicks >= TICKS_TO_GROW) {
         grow(iceSpikes);
      }
   }
}

export function onIceSpikesCollision(iceSpikes: Entity, collidingEntity: Entity): void {
   if (collidingEntity.type === IEntityType.yeti || collidingEntity.type === IEntityType.frozenYeti || collidingEntity.type === IEntityType.iceSpikes || collidingEntity.type === IEntityType.snowball) {
      return;
   }

   if (HealthComponentArray.hasComponent(collidingEntity)) {
      const healthComponent = HealthComponentArray.getComponent(collidingEntity.id);
      if (canDamageEntity(healthComponent, "ice_spikes")) {
         const hitDirection = iceSpikes.position.calculateAngleBetween(collidingEntity.position);
         
         damageEntity(collidingEntity, 1, iceSpikes, PlayerCauseOfDeath.ice_spikes, "ice_spikes");
         applyKnockback(collidingEntity, 180, hitDirection);
         SERVER.registerEntityHit({
            entityPositionX: collidingEntity.position.x,
            entityPositionY: collidingEntity.position.y,
            hitEntityID: collidingEntity.id,
            damage: 1,
            knockback: 180,
            angleFromAttacker: hitDirection,
            attackerID: iceSpikes.id,
            flags: 0
         });
         addLocalInvulnerabilityHash(healthComponent, "ice_spikes", 0.3);
   
         if (StatusEffectComponentArray.hasComponent(collidingEntity)) {
            applyStatusEffect(collidingEntity, StatusEffectConst.freezing, 5 * SettingsConst.TPS);
         }
      }
   }
}

export function onIceSpikesDeath(iceSpikes: Entity): void {
   if (Math.random() < 0.5) {
      createItemsOverEntity(iceSpikes, ItemType.frostcicle, 1, 40);
   }
   
   // 
   // Explode into a bunch of ice spikes
   // 
   
   const numProjectiles = randInt(3, 4);

   for (let i = 1; i <= numProjectiles; i++) {
      const moveDirection = 2 * Math.PI * Math.random();
      
      const position = iceSpikes.position.copy();
      position.x += 10 * Math.sin(moveDirection);
      position.y += 10 * Math.cos(moveDirection);

      const iceShard = createIceShard(position, moveDirection);

      iceShard.velocity.x = 700 * Math.sin(moveDirection);
      iceShard.velocity.y = 700 * Math.cos(moveDirection);
   }
}

export function onIceSpikesRemove(iceSpikes: Entity): void {
   HealthComponentArray.removeComponent(iceSpikes);
   StatusEffectComponentArray.removeComponent(iceSpikes);
   IceSpikesComponentArray.removeComponent(iceSpikes);
}

/** Forces an ice spike to immediately grow its maximum number of children */
const forceMaxGrowIceSpike = (iceSpikes: Entity): void => {
   const rootIceSpikesComponent = IceSpikesComponentArray.getComponent(iceSpikes.id);
   
   const connectedIceSpikes = [iceSpikes];

   while (rootIceSpikesComponent.numChildrenIceSpikes < rootIceSpikesComponent.maxChildren) {
      const growingIceSpikes = connectedIceSpikes[Math.floor(connectedIceSpikes.length * Math.random())];
      grow(growingIceSpikes);
   }
}

export function forceMaxGrowAllIceSpikes(): void {
   const entities = Object.values(Board.entityRecord);
   for (let i = 0; i < entities.length; i++) {
      const entity = entities[i];
      if (entity.type === IEntityType.iceSpikes) {
         forceMaxGrowIceSpike(entity);
      }
   }
}

export function serialiseIceSpikesComponent(_entity: Entity): IceSpikesComponentData {
   return {};
}