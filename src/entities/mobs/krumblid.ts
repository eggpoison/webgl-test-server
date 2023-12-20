import { IEntityType, ItemType, Point, randInt } from "webgl-test-shared";
import Entity from "../../GameObject";
import CircularHitbox from "../../hitboxes/CircularHitbox";
import { HealthComponentArray } from "../../components/ComponentArray";
import { HealthComponent } from "../../components/HealthComponent";
import { createItemsOverEntity } from "../../entity-shared";

const MAX_HEALTH = 15;

const KRUMBLID_SIZE = 48;

export function createKrumblid(position: Point): Entity {
   const krumblid = new Entity(position, IEntityType.krumblid);

   const hitbox = new CircularHitbox(krumblid, 0, 0, KRUMBLID_SIZE / 2);
   krumblid.addHitbox(hitbox);

   HealthComponentArray.addComponent(krumblid, new HealthComponent(MAX_HEALTH));

   return krumblid;
}

export function onKrumblidDeath(krumblid: Entity): void {
   createItemsOverEntity(krumblid, ItemType.leather, randInt(2, 3));
}