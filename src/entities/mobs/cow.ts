import { IEntityType, ItemType, Point, randInt } from "webgl-test-shared";
import Entity from "../../GameObject";
import RectangularHitbox from "../../hitboxes/RectangularHitbox";
import { HealthComponentArray } from "../../components/ComponentArray";
import { HealthComponent } from "../../components/HealthComponent";
import { createItemsOverEntity } from "../../entity-shared";

const MAX_HEALTH = 10;

export function createCow(position: Point): Entity {
   const cow = new Entity(position, IEntityType.cow);

   const hitbox = new RectangularHitbox(cow, 0, 0, 50, 100);
   cow.addHitbox(hitbox);

   HealthComponentArray.addComponent(cow, new HealthComponent(MAX_HEALTH));

   return cow;
}

export function onCowDeath(cow: Entity): void {
   createItemsOverEntity(cow, ItemType.raw_beef, randInt(1, 2));
   createItemsOverEntity(cow, ItemType.leather, randInt(0, 2));
}