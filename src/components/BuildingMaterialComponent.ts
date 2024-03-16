import { BuildingMaterial, BuildingMaterialComponentData } from "webgl-test-shared";
import Entity from "../Entity";
import { BuildingMaterialComponentArray } from "./ComponentArray";

export class BuildingMaterialComponent {
   public material: BuildingMaterial;

   constructor(material: BuildingMaterial) {
      this.material = material;
   }
}

export function serialiseBuildingMaterialComponent(entity: Entity): BuildingMaterialComponentData {
   const buildingMaterialComponent = BuildingMaterialComponentArray.getComponent(entity.id);

   return {
      material: buildingMaterialComponent.material
   };
}