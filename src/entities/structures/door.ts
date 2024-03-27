import { BuildingMaterial, COLLISION_BITS, DEFAULT_COLLISION_MASK, HitboxCollisionTypeConst, IEntityType, Point } from "webgl-test-shared";
import Entity from "../../Entity";
import { BuildingMaterialComponentArray, DoorComponentArray, HealthComponentArray, TribeComponentArray } from "../../components/ComponentArray";
import { HealthComponent } from "../../components/HealthComponent";
import { StatusEffectComponent, StatusEffectComponentArray } from "../../components/StatusEffectComponent";
import Tribe from "../../Tribe";
import RectangularHitbox from "../../hitboxes/RectangularHitbox";
import { DoorComponent } from "../../components/DoorComponent";
import { TribeComponent } from "../../components/TribeComponent";
import { PhysicsComponent, PhysicsComponentArray } from "../../components/PhysicsComponent";
import { BuildingMaterialComponent } from "../../components/BuildingMaterialComponent";
import CircularHitbox from "../../hitboxes/CircularHitbox";

const HITBOX_WIDTH = 64 - 0.05;
const HITBOX_HEIGHT = 16 - 0.05;

export const DOOR_HEALTHS = [15, 45];

export function createDoorHitboxes(entity: Entity): ReadonlyArray<CircularHitbox | RectangularHitbox> {
   const hitboxes = new Array<CircularHitbox | RectangularHitbox>();
   hitboxes.push(new RectangularHitbox(entity.position.x, entity.position.y, 0.5, 0, 0, HitboxCollisionTypeConst.hard, entity.getNextHitboxLocalID(), entity.rotation, HITBOX_WIDTH, HITBOX_HEIGHT, 0));
   return hitboxes;
}

export function createDoor(position: Point, rotation: number, tribe: Tribe, material: BuildingMaterial): Entity {
   const door = new Entity(position, IEntityType.door, COLLISION_BITS.default, DEFAULT_COLLISION_MASK);
   door.rotation = rotation;

   const hitboxes = createDoorHitboxes(door);
   for (let i = 0; i < hitboxes.length; i++) {
      door.addHitbox(hitboxes[i]);
   }
   
   PhysicsComponentArray.addComponent(door, new PhysicsComponent(false, true));
   HealthComponentArray.addComponent(door, new HealthComponent(DOOR_HEALTHS[material]));
   StatusEffectComponentArray.addComponent(door, new StatusEffectComponent(0));
   DoorComponentArray.addComponent(door, new DoorComponent(position.x, position.y, rotation));
   TribeComponentArray.addComponent(door, new TribeComponent(tribe)); 
   BuildingMaterialComponentArray.addComponent(door, new BuildingMaterialComponent(material));

   return door;
}

export function onDoorJoin(door: Entity): void {
   const tribeComponent = TribeComponentArray.getComponent(door.id);
   tribeComponent.tribe.addBuilding(door);
}

export function onWoodenDoorRemove(door: Entity): void {
   const tribeComponent = TribeComponentArray.getComponent(door.id);
   tribeComponent.tribe.removeBuilding(door);

   PhysicsComponentArray.removeComponent(door);
   HealthComponentArray.removeComponent(door);
   StatusEffectComponentArray.removeComponent(door);
   DoorComponentArray.removeComponent(door);
   TribeComponentArray.removeComponent(door);
   BuildingMaterialComponentArray.removeComponent(door);
}