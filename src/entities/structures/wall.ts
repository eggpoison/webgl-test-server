import { BuildingMaterial, COLLISION_BITS, DEFAULT_COLLISION_MASK, IEntityType, Point, StatusEffectConst } from "webgl-test-shared";
import Tribe from "../../Tribe";
import Entity from "../../Entity";
import { BlueprintComponentArray, BuildingMaterialComponentArray, HealthComponentArray, TribeComponentArray } from "../../components/ComponentArray";
import { HealthComponent } from "../../components/HealthComponent";
import RectangularHitbox from "../../hitboxes/RectangularHitbox";
import { TribeComponent } from "../../components/TribeComponent";
import { StatusEffectComponent, StatusEffectComponentArray } from "../../components/StatusEffectComponent";
import { BuildingMaterialComponent } from "../../components/BuildingMaterialComponent";
import Board from "../../Board";

const SIZE = 64 - 0.05;

const WALL_HEALTHS = [25, 75];

export function addWallHitboxes(entity: Entity): void {
   entity.addHitbox(new RectangularHitbox(entity, 1, 0, 0, SIZE, SIZE));
}

export function createWall(position: Point, tribe: Tribe): Entity {
   const wall = new Entity(position, IEntityType.wall, COLLISION_BITS.default, DEFAULT_COLLISION_MASK);

   addWallHitboxes(wall);

   const material = BuildingMaterial.wood;
   
   HealthComponentArray.addComponent(wall, new HealthComponent(WALL_HEALTHS[material]));
   StatusEffectComponentArray.addComponent(wall, new StatusEffectComponent(StatusEffectConst.bleeding));
   TribeComponentArray.addComponent(wall, new TribeComponent(tribe));
   BuildingMaterialComponentArray.addComponent(wall, new BuildingMaterialComponent(material));

   return wall;
}

export function onWallRemove(wall: Entity): void {
   // Check if the wall has a corresponding blueprint
   const ontopEntities = Board.getEntitiesAtPosition(wall.position.x, wall.position.y);
   for (let i = 0; i < ontopEntities.length; i++) {
      const entity = ontopEntities[i];

      if (entity.type === IEntityType.blueprintEntity) {
         const blueprintComponent = BlueprintComponentArray.getComponent(entity.id);
         if (blueprintComponent.associatedEntityID === wall.id) {
            entity.remove();
            break;
         }
      }
   }
   
   HealthComponentArray.removeComponent(wall);
   StatusEffectComponentArray.removeComponent(wall);
   TribeComponentArray.removeComponent(wall);
   BuildingMaterialComponentArray.removeComponent(wall);
}

export function upgradeWall(wall: Entity): void {
   const materialComponent = BuildingMaterialComponentArray.getComponent(wall.id);
   if (materialComponent.material < BuildingMaterial.stone) {
      materialComponent.material++;

      const healthComponent = HealthComponentArray.getComponent(wall.id);
      healthComponent.maxHealth = WALL_HEALTHS[materialComponent.material];
      healthComponent.health = healthComponent.maxHealth;
   }
}