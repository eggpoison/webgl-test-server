import { PathfindingNodeIndex, TribesmanAIType, TribesmanComponentData } from "webgl-test-shared";
import Entity, { ID_SENTINEL_VALUE } from "../Entity";
import { TribesmanComponentArray } from "./ComponentArray";

export const enum TribesmanPathType {
   default,
   /** Indicates that the path was caused by another tribesman wanting them to come */
   tribesmanRequest
}

export class TribesmanComponent {
   /** ID of the hut which spawned the tribesman */
   public readonly hutID: number;

   /** ID of the current entity being hunted by the tribesman */
   public huntedEntityID = ID_SENTINEL_VALUE;

   public currentAIType = TribesmanAIType.idle;
   
   public targetPatrolPositionX = -1;
   public targetPatrolPositionY = -1;

   // @Memory @Speed: This is only used to clear the ResearchBenchComponent's preemptiveOccupeeID value when
   // the tribesmen finishes researching, is there some better way which doesn't need having this value?
   public targetResearchBenchID = ID_SENTINEL_VALUE;

   public rawPath = new Array<PathfindingNodeIndex>();
   public readonly path: Array<PathfindingNodeIndex> = [];
   public pathfindingTargetNode: PathfindingNodeIndex = Number.MAX_SAFE_INTEGER;
   public pathType = TribesmanPathType.default;
   // @Cleanup @Incomplete??
   // public lastDistFromNextNode = 0;

   constructor(hutID: number) {
      this.hutID = hutID;
   }
}

export function serialiseTribesmanComponent(entity: Entity): TribesmanComponentData {
   const tribesmanComponent = TribesmanComponentArray.getComponent(entity.id);
   return {
      aiType: tribesmanComponent.currentAIType
   };
}