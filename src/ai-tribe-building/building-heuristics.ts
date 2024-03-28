import { IEntityType, PotentialPlanSafetyInfo } from "webgl-test-shared";
import Tribe from "../Tribe";
import Entity from "../Entity";
import { SafetyNodeIndex, addEntityVulnerabilityNodePositions } from "./ai-tribe-building";

const enum Vars {
   /** Minimum safety that buildings should have */
   MIN_DESIRED_SAFETY = 50,
   MIN_SAFETY_WEIGHT = 2,
   AVERAGE_SAFETY_WEIGHT = 1
}

type InfrastructureBuildingType = IEntityType.tribeTotem | IEntityType.workerHut;

const BASE_BUILDING_WEIGHTS: Record<InfrastructureBuildingType, number> = {
   [IEntityType.tribeTotem]: 10,
   [IEntityType.workerHut]: 5
};

/*
idea: make buildings weigh less the less safe they are


*/



export function buildingIsInfrastructure(entityType: IEntityType): boolean {
   return entityType !== IEntityType.wall && entityType !== IEntityType.embrasure && entityType !== IEntityType.door && entityType !== IEntityType.tunnel;
}

const getMinBuildingNodeSafety = (tribe: Tribe, occupiedIndexes: Set<SafetyNodeIndex>): number => {
   let minSafety = Number.MAX_SAFE_INTEGER;
   for (const nodeIndex of occupiedIndexes) {
      const safety = tribe.safetyNodeRecord[nodeIndex].safety;
      if (safety < minSafety) {
         minSafety = safety;
      }
   }

   return minSafety;
}

const getAverageBuildingNodeSafety = (tribe: Tribe, occupiedIndexes: Set<SafetyNodeIndex>): number => {
   let averageSafety = 0;
   for (const nodeIndex of occupiedIndexes) {
      const safety = tribe.safetyNodeRecord[nodeIndex].safety;
      averageSafety += safety;
   }

   if (averageSafety < 0) {
      averageSafety = 0;
   }
   return averageSafety / occupiedIndexes.size;
}

export function getBuildingSafety(tribe: Tribe, building: Entity, safetyInfo: PotentialPlanSafetyInfo | null): number {
   const occupiedIndexes = new Set<SafetyNodeIndex>();
   addEntityVulnerabilityNodePositions(building, occupiedIndexes, {});

   let safety = 0;

   let minSafety = getMinBuildingNodeSafety(tribe, occupiedIndexes);
   minSafety *= Vars.MIN_SAFETY_WEIGHT;
   safety += minSafety;

   let averageSafety = getAverageBuildingNodeSafety(tribe, occupiedIndexes);
   averageSafety *= Vars.AVERAGE_SAFETY_WEIGHT;
   safety += averageSafety;

   if (safetyInfo !== null) {
      safetyInfo.buildingTypes.push(building.type);
      safetyInfo.buildingIDs.push(building.id);
      safetyInfo.buildingMinSafetys.push(minSafety);
      safetyInfo.buildingAverageSafetys.push(averageSafety);
   }

   return safety;
}

export interface SafetyQuery {
   readonly safety: number;
   readonly safetyInfo: PotentialPlanSafetyInfo;
}

export function getTribeSafety(tribe: Tribe): SafetyQuery {
   let safety = 0;

   const safetyInfo: PotentialPlanSafetyInfo = {
      buildingTypes: [],
      buildingIDs: [],
      buildingMinSafetys: [],
      buildingAverageSafetys: []
   };
   
   for (let i = 0; i < tribe.buildings.length; i++) {
      const building = tribe.buildings[i];
      if (!buildingIsInfrastructure(building.type)) {
         continue;
      }

      let buildingSafety = getBuildingSafety(tribe, building, safetyInfo);
      buildingSafety *= BASE_BUILDING_WEIGHTS[building.type as InfrastructureBuildingType];
      safety += buildingSafety;
   }

   return {
      safety: safety,
      safetyInfo: safetyInfo
   };
}

export function tribeIsVulnerable(tribe: Tribe): boolean {
   for (let i = 0; i < tribe.buildings.length; i++) {
      const building = tribe.buildings[i];
      if (!buildingIsInfrastructure(building.type)) {
         continue;
      }

      const occupiedIndexes = new Set<SafetyNodeIndex>();
      addEntityVulnerabilityNodePositions(building, occupiedIndexes, {});

      const rawBuildingSafety = getAverageBuildingNodeSafety(tribe, occupiedIndexes);
      if (rawBuildingSafety < Vars.MIN_DESIRED_SAFETY) {
         return true;
      }
   }

   return false;
}