import { COLLISION_BITS, DEFAULT_COLLISION_MASK, IEntityType, ItemType, Point, SETTINGS } from "webgl-test-shared";
import Entity from "../../Entity";
import CircularHitbox from "../../hitboxes/CircularHitbox";
import { BerryBushComponentArray, HealthComponentArray, StatusEffectComponentArray } from "../../components/ComponentArray";
import { HealthComponent } from "../../components/HealthComponent";
import { createItemEntity } from "../item-entity";
import Board from "../../Board";
import { StatusEffectComponent } from "../../components/StatusEffectComponent";

const BERRY_BUSH_RADIUS = 40;

/** Number of seconds it takes for a berry bush to regrow one of its berries */
const BERRY_GROW_TIME = 30;

export function createBerryBush(position: Point): Entity {
   const berryBush = new Entity(position, IEntityType.berryBush, COLLISION_BITS.other, DEFAULT_COLLISION_MASK);

   const hitbox = new CircularHitbox(berryBush, 1, 0, 0, BERRY_BUSH_RADIUS, 0);
   berryBush.addHitbox(hitbox);

   HealthComponentArray.addComponent(berryBush, new HealthComponent(10));
   StatusEffectComponentArray.addComponent(berryBush, new StatusEffectComponent(0));
   BerryBushComponentArray.addComponent(berryBush, {
      numBerries: 5,
      berryGrowTimer: 0
   });

   berryBush.isStatic = true;
   berryBush.rotation = 2 * Math.PI * Math.random();

   return berryBush;
}

export function tickBerryBush(berryBush: Entity): void {
   const berryBushComponent = BerryBushComponentArray.getComponent(berryBush);
   if (berryBushComponent.numBerries >= 5) {
      return;
   }

   berryBushComponent.berryGrowTimer += 1 / SETTINGS.TPS;
   if (berryBushComponent.berryGrowTimer >= BERRY_GROW_TIME) {
      // Grow a new berry
      berryBushComponent.berryGrowTimer = 0;
      berryBushComponent.numBerries++;
   }
}

export function dropBerry(berryBush: Entity): void {
   const berryBushComponent = BerryBushComponentArray.getComponent(berryBush);
   if (berryBushComponent.numBerries === 0) {
      return;
   }

   berryBushComponent.numBerries--;

   // Generate new spawn positions until we find one inside the board
   let position: Point;
   let spawnDirection: number;
   do {
      // @Speed: Garbage collection
      position = berryBush.position.copy();

      spawnDirection = 2 * Math.PI * Math.random();
      const spawnOffset = Point.fromVectorForm(40, spawnDirection);

      position.add(spawnOffset);
   } while (!Board.isInBoard(position));

   const itemEntity = createItemEntity(position, ItemType.berry, 1);
   
   const velocityDirectionOffset = (Math.random() - 0.5) * Math.PI * 0.15
   itemEntity.velocity.x = 40 * Math.sin(spawnDirection + velocityDirectionOffset);
   itemEntity.velocity.y = 40 * Math.cos(spawnDirection + velocityDirectionOffset);
}

export function onBerryBushHurt(berryBush: Entity): void {
   dropBerry(berryBush);
}

export function onBerryBushRemove(berryBush: Entity): void {
   HealthComponentArray.removeComponent(berryBush);
   StatusEffectComponentArray.removeComponent(berryBush);
   BerryBushComponentArray.removeComponent(berryBush);
}