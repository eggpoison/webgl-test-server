import { COLLISION_BITS, DEFAULT_COLLISION_MASK, IEntityType, Point } from "webgl-test-shared";
import Entity from "../../Entity";
import { DoorComponentArray, HealthComponentArray, TribeComponentArray } from "../../components/ComponentArray";
import { HealthComponent } from "../../components/HealthComponent";
import { StatusEffectComponent, StatusEffectComponentArray } from "../../components/StatusEffectComponent";
import Tribe from "../../Tribe";
import RectangularHitbox from "../../hitboxes/RectangularHitbox";
import { DoorComponent } from "../../components/DoorComponent";
import { TribeComponent } from "../../components/TribeComponent";
import { PhysicsComponent, PhysicsComponentArray } from "../../components/PhysicsComponent";

const HITBOX_WIDTH = 64 - 0.05;
const HITBOX_HEIGHT = 16 - 0.05;

export function addWoodenDoorHitboxes(entity: Entity): void {
   entity.addHitbox(new RectangularHitbox(entity, 0.5, 0, 0, HITBOX_WIDTH, HITBOX_HEIGHT));
}

export function createWoodenDoor(position: Point, tribe: Tribe, rotation: number): Entity {
   const door = new Entity(position, IEntityType.woodenDoor, COLLISION_BITS.default, DEFAULT_COLLISION_MASK);
   door.rotation = rotation;

   addWoodenDoorHitboxes(door);
   
   PhysicsComponentArray.addComponent(door, new PhysicsComponent(false, true));
   HealthComponentArray.addComponent(door, new HealthComponent(15));
   StatusEffectComponentArray.addComponent(door, new StatusEffectComponent(0));
   DoorComponentArray.addComponent(door, new DoorComponent(position.x, position.y, rotation));
   TribeComponentArray.addComponent(door, new TribeComponent(tribe)); 

   return door;
}

export function onWoodenDoorRemove(door: Entity): void {
   PhysicsComponentArray.removeComponent(door);
   HealthComponentArray.removeComponent(door);
   StatusEffectComponentArray.removeComponent(door);
   DoorComponentArray.removeComponent(door);
   TribeComponentArray.removeComponent(door);
}