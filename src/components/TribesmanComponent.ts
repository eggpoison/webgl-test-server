import { PathfindingNodeIndex, TribesmanAIType, TribesmanComponentData } from "webgl-test-shared";
import Entity from "../Entity";
import { TribesmanComponentArray } from "./ComponentArray";

export const enum TribesmanPathType {
   default,
   haulingToBarrel,
   /** Indicates that the path was caused by another tribesman wanting them to come */
   tribesmanRequest
}

export class TribesmanComponent {
   /** ID of the hut which spawned the tribesman */
   public readonly hutID: number;

   /** ID of the current entity being hunted by the tribesman */
   public huntedEntityID = 0;

   public currentAIType = TribesmanAIType.idle;
   
   public targetPatrolPositionX = -1;
   public targetPatrolPositionY = -1;

   // @Memory @Speed: This is only used to clear the ResearchBenchComponent's preemptiveOccupeeID value when
   // the tribesmen finishes researching, is there some better way which doesn't need having this value?
   public targetResearchBenchID = 0;

   public rawPath = new Array<PathfindingNodeIndex>();
   public readonly path: Array<PathfindingNodeIndex> = [];
   public pathfindingTargetNode: PathfindingNodeIndex = Number.MAX_SAFE_INTEGER;
   public pathType = TribesmanPathType.default;
   // @Cleanup @Incomplete??
   // public lastDistFromNextNode = 0;

   /** Artificial cooldown added to tribesmen to make them a bit worse at bow combat */
   public extraBowCooldownTicks = 0;

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