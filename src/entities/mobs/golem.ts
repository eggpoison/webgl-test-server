import { COLLISION_BITS, DEFAULT_COLLISION_MASK, IEntityType, Point, StatusEffectConst, distance } from "webgl-test-shared";
import Entity from "../../Entity";
import { HealthComponentArray, StatusEffectComponentArray } from "../../components/ComponentArray";
import { HealthComponent } from "../../components/HealthComponent";
import CircularHitbox from "../../hitboxes/CircularHitbox";
import { StatusEffectComponent } from "../../components/StatusEffectComponent";

const BODY_GENERATION_RADIUS = 50;

const hitboxIsTooClose = (golem: Entity, hitboxX: number, hitboxY: number, hitboxRadius: number): boolean => {
   for (let j = 0; j < golem.hitboxes.length; j++) {
      const otherHitbox = golem.hitboxes[j];

      const dist = distance(hitboxX, hitboxY, golem.position.x + otherHitbox.offset.x, golem.position.y + otherHitbox.offset.y);
      if (dist <= (hitboxRadius + (otherHitbox as CircularHitbox).radius) / 2 + 2) {
         return true;
      }
   }

   return false;
}

export function createGolem(position: Point): Entity {
   const golem = new Entity(position, IEntityType.golem, COLLISION_BITS.other, DEFAULT_COLLISION_MASK);

   // Create core hitbox
   const hitbox = new CircularHitbox(golem, 0, 0, 32, 0);
   golem.addHitbox(hitbox);
   
   // Create body hitboxes
   let i = 0;
   let attempts = 0;
   while (i < 8 && ++attempts < 100) {
      const offsetMagnitude = BODY_GENERATION_RADIUS * Math.random();
      const offsetDirection = 2 * Math.PI * Math.random();
      const offsetX = offsetMagnitude * Math.sin(offsetDirection);
      const offsetY = offsetMagnitude * Math.cos(offsetDirection);
      const x = golem.position.x + offsetX;
      const y = golem.position.y + offsetY;

      const radius = Math.random() < 0.5 ? 20 : 26;

      // Make sure the hitboxes aren't too close
      if (hitboxIsTooClose(golem, x, y, radius)) {
         continue;
      }

      const hitbox = new CircularHitbox(golem, offsetX, offsetY, radius, i + 1);
      golem.addHitbox(hitbox);

      i++;
   }

   HealthComponentArray.addComponent(golem, new HealthComponent(150));
   StatusEffectComponentArray.addComponent(golem, new StatusEffectComponent(StatusEffectConst.bleeding | StatusEffectConst.burning | StatusEffectConst.poisoned));

   golem.mass = 7;

   return golem;
}

export function onGolemRemove(golem: Entity): void {
   HealthComponentArray.removeComponent(golem);
   StatusEffectComponentArray.removeComponent(golem);
}