import { BoulderComponentData, COLLISION_BITS, DEFAULT_COLLISION_MASK, IEntityType, ItemType, Point, StatusEffectConst, randInt } from "webgl-test-shared";
import Entity from "../../Entity";
import CircularHitbox from "../../hitboxes/CircularHitbox";
import { BoulderComponentArray, HealthComponentArray } from "../../components/ComponentArray";
import { HealthComponent } from "../../components/HealthComponent";
import { createItemsOverEntity } from "../../entity-shared";
import { StatusEffectComponent, StatusEffectComponentArray } from "../../components/StatusEffectComponent";
import { wasTribeMemberKill } from "../tribes/tribe-member";

const RADIUS = 40;

export function createBoulder(position: Point): Entity {
   const boulder = new Entity(position, IEntityType.boulder, COLLISION_BITS.default, DEFAULT_COLLISION_MASK);
   boulder.rotation = 2 * Math.PI * Math.random();

   const hitbox = new CircularHitbox(boulder, 1.25, 0, 0, RADIUS);
   boulder.addHitbox(hitbox);

   HealthComponentArray.addComponent(boulder, new HealthComponent(40));
   StatusEffectComponentArray.addComponent(boulder, new StatusEffectComponent(StatusEffectConst.poisoned));
   BoulderComponentArray.addComponent(boulder, {
      boulderType: Math.floor(Math.random() * 2)
   });
   
   return boulder;
}

export function onBoulderDeath(boulder: Entity, attackingEntity: Entity): void {
   if (wasTribeMemberKill(attackingEntity)) {
      createItemsOverEntity(boulder, ItemType.rock, randInt(5, 7), 40);
   }
}

export function onBoulderRemove(boulder: Entity): void {
   HealthComponentArray.removeComponent(boulder);
   StatusEffectComponentArray.removeComponent(boulder);
   BoulderComponentArray.removeComponent(boulder);
}

export function serialiseBoulderComponent(boulder: Entity): BoulderComponentData {
   const boulderComponent = BoulderComponentArray.getComponent(boulder.id);
   return {
      boulderType: boulderComponent.boulderType
   };
}