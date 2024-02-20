import { COLLISION_BITS, DEFAULT_COLLISION_MASK, IEntityType, ItemType, Point } from "webgl-test-shared";
import Tribe from "../../Tribe";
import Entity from "../../Entity";
import { HealthComponentArray, TribeComponentArray } from "../../components/ComponentArray";
import { HealthComponent } from "../../components/HealthComponent";
import RectangularHitbox from "../../hitboxes/RectangularHitbox";
import { TribeComponent } from "../../components/TribeComponent";
import { wasTribeMemberKill } from "../tribes/tribe-member";
import { createItemsOverEntity } from "../../entity-shared";

const SIZE = 64 - 0.05;

export function createWoodenWall(position: Point, tribe: Tribe | null): Entity {
   const wall = new Entity(position, IEntityType.woodenWall, COLLISION_BITS.default, DEFAULT_COLLISION_MASK);

   const hitbox = new RectangularHitbox(wall, 1, 0, 0, SIZE, SIZE, 0);
   wall.addHitbox(hitbox);
   
   HealthComponentArray.addComponent(wall, new HealthComponent(25));
   TribeComponentArray.addComponent(wall, new TribeComponent(tribe));

   return wall;
}

export function onWoodenWallDeath(wall: Entity, attackingEntity: Entity | null): void {
   if (wasTribeMemberKill(attackingEntity)) {
      createItemsOverEntity(wall, ItemType.wooden_wall, 1)
   }
}

export function onWoodenWallRemove(wall: Entity): void {
   HealthComponentArray.removeComponent(wall);
   TribeComponentArray.removeComponent(wall);
}