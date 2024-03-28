import { VisibleChunkBounds, VulnerabilityNodeData, BuildingPlanData, SettingsConst, IEntityType, PotentialBuildingPlanData, BuildingVulnerabilityData, RestrictedBuildingAreaData } from "webgl-test-shared";
import Board from "../Board";
import Tribe from "../Tribe";
import { TribeComponentArray } from "../components/ComponentArray";
import { getSafetyNodeIndex } from "./ai-tribe-building";
import { buildingIsInfrastructure, getBuildingSafety } from "./building-heuristics";

export function getVisibleTribes(chunkBounds: VisibleChunkBounds): ReadonlyArray<Tribe> {
   // Calculate visible tribes
   const visibleTribes = new Array<Tribe>();
   for (let chunkX = chunkBounds[0]; chunkX <= chunkBounds[1]; chunkX++) {
      for (let chunkY = chunkBounds[2]; chunkY <= chunkBounds[3]; chunkY++) {
         const chunk = Board.getChunk(chunkX, chunkY);
         for (let i = 0; i < chunk.entities.length; i++) {
            const entity = chunk.entities[i];
            if (TribeComponentArray.hasComponent(entity)) {
               const tribeComponent = TribeComponentArray.getComponent(entity.id);
               if (visibleTribes.indexOf(tribeComponent.tribe) === -1) {
                  visibleTribes.push(tribeComponent.tribe);
               }
            }
         }
      }
   }
   return visibleTribes;
}

export function getVisibleVulnerabilityNodesData(visibleTribes: ReadonlyArray<Tribe>, chunkBounds: VisibleChunkBounds): ReadonlyArray<VulnerabilityNodeData> {
   const vulnerabilityNodesData = new Array<VulnerabilityNodeData>();
   for (let i = 0; i < visibleTribes.length; i++) {
      const tribe = visibleTribes[i];

      for (let j = 0; j < tribe.safetyNodes.length; j++) {
         const node = tribe.safetyNodes[j];

         // @Incomplete: filter out nodes which aren't in the chunk bounds
         
         const nodeIndex = getSafetyNodeIndex(node.x, node.y);
         vulnerabilityNodesData.push({
            index: nodeIndex,
            vulnerability: node.safety,
            isOccupied: tribe.occupiedSafetyNodes.has(nodeIndex),
            isContained: tribe.insideNodes.has(nodeIndex) || (tribe.occupiedNodeToEntityIDRecord[nodeIndex] !== undefined && tribe.containedBuildingIDs.has(tribe.occupiedNodeToEntityIDRecord[nodeIndex]))
         });
      }
   }

   return vulnerabilityNodesData;
}

export function getVisibleBuildingPlans(visibleTribes: ReadonlyArray<Tribe>, chunkBounds: VisibleChunkBounds): ReadonlyArray<BuildingPlanData> {
   const buildingPlansData = new Array<BuildingPlanData>();
   for (let i = 0; i < visibleTribes.length; i++) {
      const tribe = visibleTribes[i];

      if (tribe.buildingPlan !== null) {
         // @Cleanup: hardcoded
         const minChunkX = Math.max(Math.floor((tribe.buildingPlan.position.x - 800) / SettingsConst.CHUNK_UNITS), 0);
         const maxChunkX = Math.min(Math.floor((tribe.buildingPlan.position.x + 800) / SettingsConst.CHUNK_UNITS), SettingsConst.BOARD_SIZE - 1);
         const minChunkY = Math.max(Math.floor((tribe.buildingPlan.position.y - 800) / SettingsConst.CHUNK_UNITS), 0);
         const maxChunkY = Math.min(Math.floor((tribe.buildingPlan.position.y + 800) / SettingsConst.CHUNK_UNITS), SettingsConst.BOARD_SIZE - 1);

         if (minChunkX <= chunkBounds[1] && maxChunkX >= chunkBounds[0] && minChunkY <= chunkBounds[3] && maxChunkY >= chunkBounds[2]) {
            buildingPlansData.push({
               x: tribe.buildingPlan.position.x,
               y: tribe.buildingPlan.position.y,
               rotation: tribe.buildingPlan.rotation,
               entityType: IEntityType.wall
            });
         }
      }
   }

   return buildingPlansData;
}

export function getVisiblePotentialBuildingPlans(visibleTribes: ReadonlyArray<Tribe>, chunkBounds: VisibleChunkBounds): ReadonlyArray<PotentialBuildingPlanData> {
   const potentialPlansData = new Array<PotentialBuildingPlanData>();
   for (let i = 0; i < visibleTribes.length; i++) {
      const tribe = visibleTribes[i];

      for (let i = 0; i < tribe.potentialPlansData.length; i++) {
         const potentialPlanData = tribe.potentialPlansData[i];
      
         // @Incomplete: filter out potential plans which aren't visible
         
         potentialPlansData.push(potentialPlanData);
      }
   }

   return potentialPlansData;
}

export function getVisibleBuildingVulnerabilities(visibleTribes: ReadonlyArray<Tribe>, chunkBounds: VisibleChunkBounds): ReadonlyArray<BuildingVulnerabilityData> {
   const buildingVulnerabiliesData = new Array<BuildingVulnerabilityData>();
   for (let i = 0; i < visibleTribes.length; i++) {
      const tribe = visibleTribes[i];

      for (let i = 0; i < tribe.buildings.length; i++) {
         const building = tribe.buildings[i];
         if (!buildingIsInfrastructure(building.type)) {
            continue;
         }
         // @Incomplete: filter out nodes which aren't in the chunk bounds

         buildingVulnerabiliesData.push({
            x: building.position.x,
            y: building.position.y,
            safety: getBuildingSafety(tribe, building, null)
         });
      }
   }

   return buildingVulnerabiliesData;
}

export function getVisibleRestrictedBuildingAreas(visibleTribes: ReadonlyArray<Tribe>, chunkBounds: VisibleChunkBounds): ReadonlyArray<RestrictedBuildingAreaData> {
   const restrictedAreasData = new Array<RestrictedBuildingAreaData>();
   for (let i = 0; i < visibleTribes.length; i++) {
      const tribe = visibleTribes[i];

      for (let i = 0; i < tribe.restrictedBuildingAreas.length; i++) {
         const restrictedArea = tribe.restrictedBuildingAreas[i];

         // @Incomplete: filter out areas which aren't in the chunk bounds

         restrictedAreasData.push({
            x: restrictedArea.x,
            y: restrictedArea.y,
            rotation: restrictedArea.rotation,
            width: restrictedArea.width,
            height: restrictedArea.height
         });
      }
   }

   return restrictedAreasData;
}