import { COLLISION_BITS, DEFAULT_COLLISION_MASK, IEntityType, Point } from "webgl-test-shared";
import Tribe from "../../Tribe";
import Entity from "../../Entity";
import { HealthComponentArray, TribeComponentArray } from "../../components/ComponentArray";
import { HealthComponent } from "../../components/HealthComponent";
import RectangularHitbox from "../../hitboxes/RectangularHitbox";
import { TribeComponent } from "../../components/TribeComponent";

const HITBOX_WIDTH = 20 - 0.05;
const HITBOX_HEIGHT = 20 - 0.05;

export function createWoodenEmbrasure(position: Point, tribe: Tribe | null, rotation: number): Entity {
   const embrasure = new Entity(position, IEntityType.woodenEmbrasure, COLLISION_BITS.default, DEFAULT_COLLISION_MASK);
   embrasure.rotation = rotation;

   embrasure.addHitbox(new RectangularHitbox(embrasure, 0.4, -(64 - HITBOX_WIDTH) / 2 + 0.025, 0, HITBOX_WIDTH, HITBOX_HEIGHT));
   embrasure.addHitbox(new RectangularHitbox(embrasure, 0.4, (64 - HITBOX_WIDTH) / 2 - 0.025, 0, HITBOX_WIDTH, HITBOX_HEIGHT));
   
   HealthComponentArray.addComponent(embrasure, new HealthComponent(20));
   TribeComponentArray.addComponent(embrasure, new TribeComponent(tribe));

   return embrasure;
}

export function onWoodenEmbrasureRemove(embrasure: Entity): void {
   HealthComponentArray.removeComponent(embrasure);
   TribeComponentArray.removeComponent(embrasure);
}