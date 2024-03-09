import { EntityDebugData, Mutable } from "webgl-test-shared";
import Entity from "./Entity";
import { TribesmanComponentArray } from "./components/ComponentArray";
import { TRIBESMAN_COMMUNICATION_RANGE, getTribesmanVisionRange } from "./entities/tribes/tribesman";

export function getEntityDebugData(entity: Entity): EntityDebugData {
   // @Cleanup: I really don't like this mutable partial type situation
   const debugData: Mutable<Partial<EntityDebugData>> = {
      entityID: entity.id,
      lines: [],
      circles: [],
      tileHighlights: [],
      debugEntries: []
   };

   if (TribesmanComponentArray.hasComponent(entity)) {
      const tribesmanComponent = TribesmanComponentArray.getComponent(entity);
      if (tribesmanComponent.path.length > 0) {
         debugData.pathData = {
            pathNodes: tribesmanComponent.path,
            rawPathNodes: tribesmanComponent.rawPath
         };
      }

      // Vision range
      debugData.circles!.push({
         radius: getTribesmanVisionRange(entity),
         thickness: 2,
         colour: [0, 0, 1]
      });
      
      // Communication range
      debugData.circles!.push({
         radius: TRIBESMAN_COMMUNICATION_RANGE,
         thickness: 2,
         colour: [1, 1, 0]
      });
   }

   return debugData as EntityDebugData;
}