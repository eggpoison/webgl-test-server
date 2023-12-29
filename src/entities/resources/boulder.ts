import { COLLISION_BITS, DEFAULT_COLLISION_MASK, IEntityType, ItemType, Point, randInt } from "webgl-test-shared";
import Entity from "../../Entity";
import CircularHitbox from "../../hitboxes/CircularHitbox";
import { BoulderComponentArray, HealthComponentArray, StatusEffectComponentArray } from "../../components/ComponentArray";
import { HealthComponent } from "../../components/HealthComponent";
import { createItemsOverEntity } from "../../entity-shared";
import { StatusEffectComponent } from "../../components/StatusEffectComponent";

const RADIUS = 40;

export function createBoulder(position: Point): Entity {
   const boulder = new Entity(position, IEntityType.boulder, COLLISION_BITS.other, DEFAULT_COLLISION_MASK);

   const hitbox = new CircularHitbox(boulder, 0, 0, RADIUS);
   boulder.addHitbox(hitbox);

   HealthComponentArray.addComponent(boulder, new HealthComponent(40));
   StatusEffectComponentArray.addComponent(boulder, new StatusEffectComponent());
   BoulderComponentArray.addComponent(boulder, {
      boulderType: Math.floor(Math.random() * 2)
   });
   
   boulder.isStatic = true;
   boulder.rotation = 2 * Math.PI * Math.random();
   
   return boulder;
}

export function onBoulderDeath(boulder: Entity, attackingEntity: Entity): void {
   if (attackingEntity.type === IEntityType.player || attackingEntity.type === IEntityType.tribesman) {
      createItemsOverEntity(boulder, ItemType.rock, randInt(5, 7));
   }
}

export function onBoulderRemove(boulder: Entity): void {
   HealthComponentArray.removeComponent(boulder);
   StatusEffectComponentArray.removeComponent(boulder);
   BoulderComponentArray.removeComponent(boulder);
}