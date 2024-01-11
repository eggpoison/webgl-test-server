import { COLLISION_BITS, DEFAULT_COLLISION_MASK, IEntityType, Point, StatusEffectConst, distance } from "webgl-test-shared";
import Entity from "../../Entity";
import { HealthComponentArray, StatusEffectComponentArray } from "../../components/ComponentArray";
import { HealthComponent } from "../../components/HealthComponent";
import CircularHitbox from "../../hitboxes/CircularHitbox";
import { StatusEffectComponent } from "../../components/StatusEffectComponent";

const BODY_GENERATION_RADIUS = 50;

const ROCK_SMALL_MASS = 0.75;
const ROCK_MEDIUM_MASS = 1;
const ROCK_LARGE_MASS = 1.25;

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
   const hitbox = new CircularHitbox(golem, ROCK_LARGE_MASS, 0, 0, 32, 0);
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

      const size = Math.random() < 0.4 ? 0 : 1;
      const radius = size === 0 ? 20 : 26;

      // Make sure the hitboxes aren't too close
      if (hitboxIsTooClose(golem, x, y, radius)) {
         continue;
      }

      const mass = size === 0 ? ROCK_SMALL_MASS : ROCK_MEDIUM_MASS;
      const hitbox = new CircularHitbox(golem, mass, offsetX, offsetY, radius, i + 1);
      golem.addHitbox(hitbox);

      i++;
   }

   // Create hand hitboxes
   for (let j = 0; j < 2; j++) {
      const offsetX = 60 * (j === 0 ? -1 : 1);
      const hitbox = new CircularHitbox(golem, ROCK_MEDIUM_MASS, offsetX, 50, 20, 1 + i + j);
      golem.addHitbox(hitbox);
   }

   HealthComponentArray.addComponent(golem, new HealthComponent(150));
   StatusEffectComponentArray.addComponent(golem, new StatusEffectComponent(StatusEffectConst.bleeding | StatusEffectConst.burning | StatusEffectConst.poisoned));

   return golem;
}

export function onGolemRemove(golem: Entity): void {
   HealthComponentArray.removeComponent(golem);
   StatusEffectComponentArray.removeComponent(golem);
}