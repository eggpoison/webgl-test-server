import { HitboxVertexPositions, IEntityType, ITEM_INFO_RECORD, ItemType, PlaceableItemInfo, Point, PotentialBuildingPlanData, SettingsConst, circleAndRectangleDoIntersect, distBetweenPointAndRectangle, getItemRecipe, pointIsInRectangle, rectanglePointsDoIntersect } from "webgl-test-shared";
import Entity from "../Entity";
import Tribe, { BuildingPlan, RestrictedBuildingArea } from "../Tribe";
import CircularHitbox from "../hitboxes/CircularHitbox";
import RectangularHitbox from "../hitboxes/RectangularHitbox";
import Board from "../Board";
import { getDistanceFromPointToEntity } from "../ai-shared";
import { createBuildingHitboxes } from "../buildings";
import { getTribeSafety, tribeIsVulnerable } from "./building-heuristics";

const enum Vars {
   /** Base amount the vulnerability decreases when moving in a node */
   SAFE_DISTANCE_FALLOFF = 5,
   /** Falloff from distance from outside the padding */
   DISTANCE_FALLOFF = 1,
   OCCUPIED_NODE_WEIGHT = 10,
   BORDER_PADDING = 5,
   /** Distance that the AI will try to snap new walls to existing ones */
   WALL_SNAP_SEARCH_DISTANCE = 200,
   PLAN_COMPLETE_RANGE = 10
}

export type SafetyNodeIndex = number;

// @Cleanup @Memory: Can remove x and y.
// @Cleanup: Might be able to just make into number
export interface SafetyNode {
   readonly x: number;
   readonly y: number;
   /** How safe the node is. Minumum of 0 for having no safety whatsoever. */
   safety: number;
};

export function createRestrictedBuildingArea(x: number, y: number, width: number, height: number, rotation: number, associatedBuildingID: number): RestrictedBuildingArea {
   const sinRotation = Math.sin(rotation);
   const cosRotation = Math.cos(rotation);

   const x1 = width * -0.5;
   const x2 = width * 0.5;
   const y2 = height * 0.5;
   
   const topLeftX = cosRotation * x1 + sinRotation * y2;
   const topLeftY = cosRotation * y2 - sinRotation * x1;
   const topRightX = cosRotation * x2 + sinRotation * y2;
   const topRightY = cosRotation * y2 - sinRotation * x2;

   const vertexOffsets: HitboxVertexPositions = [
      new Point(topLeftX, topLeftY),
      new Point(topRightX, topRightY),
      new Point(-topLeftX, -topLeftY),
      new Point(-topRightX, -topRightY)
   ];
   
   return {
      x: x,
      y: y,
      width: width,
      height: height,
      rotation: rotation,
      associatedBuildingID: associatedBuildingID,
      vertexOffsets: vertexOffsets
   };
}

export function getSafetyNodeIndex(nodeX: number, nodeY: number): SafetyNodeIndex {
   return nodeY * SettingsConst.SAFETY_NODES_IN_WORLD_WIDTH + nodeX;
}

const addCircularHitboxNodePositions = (entityID: number, hitbox: CircularHitbox, positions: Set<SafetyNodeIndex>, occupiedNodeToEntityIDRecord: Record<SafetyNodeIndex, number>): void => {
   const minX = hitbox.calculateHitboxBoundsMinX();
   const maxX = hitbox.calculateHitboxBoundsMaxX();
   const minY = hitbox.calculateHitboxBoundsMinY();
   const maxY = hitbox.calculateHitboxBoundsMaxY();

   const centerX = hitbox.x / SettingsConst.SAFETY_NODE_SEPARATION;
   const centerY = hitbox.y / SettingsConst.SAFETY_NODE_SEPARATION;
   
   const minNodeX = Math.max(Math.floor(minX / SettingsConst.SAFETY_NODE_SEPARATION), 0);
   const maxNodeX = Math.min(Math.ceil(maxX / SettingsConst.SAFETY_NODE_SEPARATION), SettingsConst.SAFETY_NODES_IN_WORLD_WIDTH - 1);
   const minNodeY = Math.max(Math.floor(minY / SettingsConst.SAFETY_NODE_SEPARATION), 0);
   const maxNodeY = Math.min(Math.ceil(maxY / SettingsConst.SAFETY_NODE_SEPARATION), SettingsConst.SAFETY_NODES_IN_WORLD_WIDTH - 1);

   const hitboxNodeRadius = hitbox.radius / SettingsConst.SAFETY_NODE_SEPARATION + 0.5;
   const hitboxNodeRadiusSquared = hitboxNodeRadius * hitboxNodeRadius;

   for (let nodeX = minNodeX; nodeX <= maxNodeX; nodeX++) {
      for (let nodeY = minNodeY; nodeY <= maxNodeY; nodeY++) {
         const xDiff = nodeX - centerX;
         const yDiff = nodeY - centerY;
         if (xDiff * xDiff + yDiff * yDiff <= hitboxNodeRadiusSquared) {
            const nodeIndex = getSafetyNodeIndex(nodeX, nodeY);
            positions.add(nodeIndex);
            occupiedNodeToEntityIDRecord[nodeIndex] = entityID;
         }
      }
   }
}

const addRectangularNodePositions = (entityID: number, rectX: number, rectY: number, rectWidth: number, rectHeight: number, rectRotation: number, rectMinX: number, rectMaxX: number, rectMinY: number, rectMaxY: number, positions: Set<SafetyNodeIndex>, occupiedNodeToEntityIDRecord: Record<SafetyNodeIndex, number>): void => {
   // @Speed: Math.round might also work
   const minNodeX = Math.max(Math.floor(rectMinX / SettingsConst.SAFETY_NODE_SEPARATION), 0);
   const maxNodeX = Math.min(Math.ceil(rectMaxX / SettingsConst.SAFETY_NODE_SEPARATION), SettingsConst.SAFETY_NODES_IN_WORLD_WIDTH - 1);
   const minNodeY = Math.max(Math.floor(rectMinY / SettingsConst.SAFETY_NODE_SEPARATION), 0);
   const maxNodeY = Math.min(Math.floor(rectMaxY / SettingsConst.SAFETY_NODE_SEPARATION), SettingsConst.SAFETY_NODES_IN_WORLD_WIDTH - 1);

   for (let nodeX = minNodeX; nodeX <= maxNodeX; nodeX++) {
      for (let nodeY = minNodeY; nodeY <= maxNodeY; nodeY++) {
         const x = nodeX * SettingsConst.SAFETY_NODE_SEPARATION;
         const y = nodeY * SettingsConst.SAFETY_NODE_SEPARATION;
         if (distBetweenPointAndRectangle(x, y, rectX, rectY, rectWidth, rectHeight, rectRotation) <= SettingsConst.SAFETY_NODE_SEPARATION * 0.5) {
            const nodeIndex = getSafetyNodeIndex(nodeX, nodeY);
            positions.add(nodeIndex);
            occupiedNodeToEntityIDRecord[nodeIndex] = entityID;
         }
      }
   }
}

export function addEntityVulnerabilityNodePositions(entity: Entity, positions: Set<SafetyNodeIndex>, occupiedNodeToEntityIDRecord: Record<SafetyNodeIndex, number>): void {
   for (let i = 0; i < entity.hitboxes.length; i++) {
      const hitbox = entity.hitboxes[i];

      // Add to occupied pathfinding nodes
      if (hitbox.hasOwnProperty("radius")) {
         addCircularHitboxNodePositions(entity.id, hitbox as CircularHitbox, positions, occupiedNodeToEntityIDRecord);
      } else {
         const rect = hitbox as RectangularHitbox;
         addRectangularNodePositions(entity.id, rect.x, rect.y, rect.width, rect.height, rect.rotation, rect.calculateHitboxBoundsMinX(), rect.calculateHitboxBoundsMaxX(), rect.calculateHitboxBoundsMinY(), rect.calculateHitboxBoundsMaxY(), positions, occupiedNodeToEntityIDRecord);
      }
   }
}

interface OccupiedNodesInfo {
   readonly occupiedNodeIndexes: Set<SafetyNodeIndex>;
   readonly occupiedNodeToEntityIDRecord: Record<SafetyNodeIndex, number>;
}

const getOccupiedNodesInfo = (tribe: Tribe): OccupiedNodesInfo => {
   const positions = new Set<SafetyNodeIndex>();
   const occupiedNodeToEntityIDRecord: Record<SafetyNodeIndex, number> = {};

   // Add nodes from buildings
   for (let i = 0; i < tribe.buildings.length; i++) {
      const building = tribe.buildings[i];
      addEntityVulnerabilityNodePositions(building, positions, occupiedNodeToEntityIDRecord);
   }
   
   return {
      occupiedNodeIndexes: positions,
      occupiedNodeToEntityIDRecord: occupiedNodeToEntityIDRecord
   };
}

/** Gets all nodes within the tribe's bounding area which aren't occupied */
const getAreaNodes = (occupiedNodeIndexes: Set<SafetyNodeIndex>, minNodeX: number, maxNodeX: number, minNodeY: number, maxNodeY: number): Set<SafetyNodeIndex> => {
   const area = new Set<SafetyNodeIndex>();
   for (let nodeX = minNodeX; nodeX <= maxNodeX; nodeX++) {
      for (let nodeY = minNodeY; nodeY <= maxNodeY; nodeY++) {
         const nodeIndex = getSafetyNodeIndex(nodeX, nodeY);
         if (!occupiedNodeIndexes.has(nodeIndex)) {
            area.add(nodeIndex);
         }
      }
   }
   return area;
}

const weightNodeDistance = (node: SafetyNode, dist: number): void => {
   node.safety += dist * Vars.DISTANCE_FALLOFF;
}

const getNodeDist = (nodeIndex: number, minDist: number, nodeRecord: Record<number, SafetyNode>): number => {
   const originNodeX = nodeIndex % SettingsConst.SAFETY_NODES_IN_WORLD_WIDTH;
   const originNodeY = Math.floor(nodeIndex / SettingsConst.SAFETY_NODES_IN_WORLD_WIDTH);

   for (let dist = minDist; ; dist++) {
      const minNodeX = Math.max(originNodeX - dist, 0);
      const maxNodeX = Math.min(originNodeX + dist, SettingsConst.SAFETY_NODES_IN_WORLD_WIDTH - 1);
      const minNodeY = Math.max(originNodeY - dist, 0);
      const maxNodeY = Math.min(originNodeY + dist, SettingsConst.SAFETY_NODES_IN_WORLD_WIDTH - 1);
      for (let nodeX = minNodeX; nodeX <= maxNodeX; nodeX++) {
         for (let nodeY = minNodeY; nodeY <= maxNodeY; nodeY++) {
            const diffX = nodeX - originNodeX;
            const diffY = nodeY - originNodeY;
            if (diffX * diffX + diffY * diffY <= dist * dist) {
               const nodeIndex = getSafetyNodeIndex(nodeX, nodeY);
               if (nodeRecord[nodeIndex] === undefined) {
                  return dist;
               }
            }
         }
      }
   }
}

const weightNodeDistances = (nodeRecord: Record<number, SafetyNode>, outmostPaddingNodes: Set<SafetyNodeIndex>): void => {
   if (outmostPaddingNodes.size === 0) {
      return;
   }
   
   let startingNode!: SafetyNodeIndex;
   for (const nodeIndex of outmostPaddingNodes) {
      startingNode = nodeIndex;
      break;
   }
   
   const checkedNodes = new Set<SafetyNodeIndex>();
   const nodesToCheck = [startingNode];
   const adjacentDistsToCheck = [1];
   while (nodesToCheck.length > 0) {
      const currentNodeIndex = nodesToCheck[0];
      const adjacentDist = adjacentDistsToCheck[0];

      nodesToCheck.splice(0, 1);
      adjacentDistsToCheck.splice(0, 1);

      const dist = getNodeDist(currentNodeIndex, adjacentDist - 1, nodeRecord);
      weightNodeDistance(nodeRecord[currentNodeIndex], dist);

      const nodeX = currentNodeIndex % SettingsConst.SAFETY_NODES_IN_WORLD_WIDTH;
      const nodeY = Math.floor(currentNodeIndex / SettingsConst.SAFETY_NODES_IN_WORLD_WIDTH);

      // Top
      if (nodeY < SettingsConst.SAFETY_NODES_IN_WORLD_WIDTH - 1) {
         const nodeIndex = getSafetyNodeIndex(nodeX, nodeY + 1);
         if (!checkedNodes.has(nodeIndex) && nodeRecord[nodeIndex] !== undefined) {
            checkedNodes.add(nodeIndex);
            nodesToCheck.push(nodeIndex);
            adjacentDistsToCheck.push(adjacentDist);
         }
      }

      // Right
      if (nodeX < SettingsConst.SAFETY_NODES_IN_WORLD_WIDTH - 1) {
         const nodeIndex = getSafetyNodeIndex(nodeX + 1, nodeY);
         if (!checkedNodes.has(nodeIndex) && nodeRecord[nodeIndex] !== undefined) {
            checkedNodes.add(nodeIndex);
            nodesToCheck.push(nodeIndex);
            adjacentDistsToCheck.push(adjacentDist);
         }
      }

      // Bottom
      if (nodeY > 0) {
         const nodeIndex = getSafetyNodeIndex(nodeX, nodeY - 1);
         if (!checkedNodes.has(nodeIndex) && nodeRecord[nodeIndex] !== undefined) {
            checkedNodes.add(nodeIndex);
            nodesToCheck.push(nodeIndex);
            adjacentDistsToCheck.push(adjacentDist);
         }
      }

      // Left
      if (nodeX > 0) {
         const nodeIndex = getSafetyNodeIndex(nodeX - 1, nodeY);
         if (!checkedNodes.has(nodeIndex) && nodeRecord[nodeIndex] !== undefined) {
            checkedNodes.add(nodeIndex);
            nodesToCheck.push(nodeIndex);
            adjacentDistsToCheck.push(adjacentDist);
         }
      }
   }
}

const calculateNodeSafety = (minAdjacentSafety: number, isOccupied: boolean): number => {
   let vulnerability = minAdjacentSafety + Vars.SAFE_DISTANCE_FALLOFF;
   if (isOccupied) {
      vulnerability += Vars.OCCUPIED_NODE_WEIGHT;
   }

   if (vulnerability < 0) {
      vulnerability = 0;
   }
   return vulnerability;
}

// @Cleanup: Name. Doesn't just update safety nodes
const updateTribeSafetyNodes = (tribe: Tribe, occupiedNodeIndexes: Set<SafetyNodeIndex>, occupiedNodeToEntityIDRecord: Record<SafetyNodeIndex, number>): void => {
   // Find min and max node positions
   let minNodeX = SettingsConst.SAFETY_NODES_IN_WORLD_WIDTH - 1;
   let maxNodeX = 0;
   let minNodeY = SettingsConst.SAFETY_NODES_IN_WORLD_WIDTH - 1;
   let maxNodeY = 0;
   for (const nodeIndex of occupiedNodeIndexes) {
      const nodeX = nodeIndex % SettingsConst.SAFETY_NODES_IN_WORLD_WIDTH;
      const nodeY = Math.floor(nodeIndex / SettingsConst.SAFETY_NODES_IN_WORLD_WIDTH);

      if (nodeX < minNodeX) {
         minNodeX = nodeX;
      }
      if (nodeX > maxNodeX) {
         maxNodeX = nodeX;
      }
      if (nodeY < minNodeY) {
         minNodeY = nodeY;
      }
      if (nodeY > maxNodeY) {
         maxNodeY = nodeY;
      }
   }
   const minBorderNodeX = Math.max(minNodeX - 1, 0);
   const maxBorderNodeX = Math.min(maxNodeX + 1, SettingsConst.SAFETY_NODES_IN_WORLD_WIDTH - 1);
   const minBorderNodeY = Math.max(minNodeY - 1, 0);
   const maxBorderNodeY = Math.min(maxNodeY + 1, SettingsConst.SAFETY_NODES_IN_WORLD_WIDTH - 1);

   const areaNodes = getAreaNodes(occupiedNodeIndexes, minNodeX, maxNodeX, minNodeY, maxNodeY);

   // Find inside nodes and contained buildings
   const containedBuildingIDs = new Set<number>();
   const insideNodeIndexes = new Set<SafetyNodeIndex>();
   while (areaNodes.size > 0) {
      // Start at the first element in the set
      let originNodeIndex!: SafetyNodeIndex;
      for (const nodeIndex of areaNodes) {
         originNodeIndex = nodeIndex;
         break;
      }

      let isInside = true;
      const encounteredOccupiedNodeIndexes = new Set<SafetyNodeIndex>();

      // @Speed: Span filling
      // Get all connected nodes
      const connectedNodes = [];
      const nodesToCheck = [originNodeIndex];
      while (nodesToCheck.length > 0) {
         const nodeIndex = nodesToCheck[0];
         const nodeX = nodeIndex % SettingsConst.SAFETY_NODES_IN_WORLD_WIDTH;
         const nodeY = Math.floor(nodeIndex / SettingsConst.SAFETY_NODES_IN_WORLD_WIDTH);

         connectedNodes.push(nodeIndex);
         nodesToCheck.splice(0, 1);

         areaNodes.delete(nodeIndex);

         // @Speed: If outside, immediately break and do the above on the remaining nodes

         // Top
         if (nodeY < SettingsConst.SAFETY_NODES_IN_WORLD_WIDTH - 1) {
            const nodeIndex = getSafetyNodeIndex(nodeX, nodeY + 1);
            if (!occupiedNodeIndexes.has(nodeIndex) && connectedNodes.indexOf(nodeIndex) === -1 && nodesToCheck.indexOf(nodeIndex) === -1) {
               if (nodeY + 1 === maxBorderNodeY) {
                  isInside = false;
               } else {
                  nodesToCheck.push(nodeIndex);
               }
            }
            if (occupiedNodeIndexes.has(nodeIndex)) {
               encounteredOccupiedNodeIndexes.add(nodeIndex);
            }
         }

         // Right
         if (nodeX < SettingsConst.SAFETY_NODES_IN_WORLD_WIDTH - 1) {
            const nodeIndex = getSafetyNodeIndex(nodeX + 1, nodeY);
            if (!occupiedNodeIndexes.has(nodeIndex) && connectedNodes.indexOf(nodeIndex) === -1 && nodesToCheck.indexOf(nodeIndex) === -1) {
               if (nodeX + 1 === maxBorderNodeX) {
                  isInside = false;
               } else {
                  nodesToCheck.push(nodeIndex);
               }
            }
            if (occupiedNodeIndexes.has(nodeIndex)) {
               encounteredOccupiedNodeIndexes.add(nodeIndex);
            }
         }

         // Bottom
         if (nodeY > 0) {
            const nodeIndex = getSafetyNodeIndex(nodeX, nodeY - 1);
            if (!occupiedNodeIndexes.has(nodeIndex) && connectedNodes.indexOf(nodeIndex) === -1 && nodesToCheck.indexOf(nodeIndex) === -1) {
               if (nodeY - 1 === minBorderNodeY) {
                  isInside = false;
               } else {
                  nodesToCheck.push(nodeIndex);
               }
            }
            if (occupiedNodeIndexes.has(nodeIndex)) {
               encounteredOccupiedNodeIndexes.add(nodeIndex);
            }
         }

         // Left
         if (nodeX > 0) {
            const nodeIndex = getSafetyNodeIndex(nodeX - 1, nodeY);
            if (!occupiedNodeIndexes.has(nodeIndex) && connectedNodes.indexOf(nodeIndex) === -1 && nodesToCheck.indexOf(nodeIndex) === -1) {
               if (nodeX - 1 === minBorderNodeX) {
                  isInside = false;
               } else {
                  nodesToCheck.push(nodeIndex);
               }
            }
            if (occupiedNodeIndexes.has(nodeIndex)) {
               encounteredOccupiedNodeIndexes.add(nodeIndex);
            }
         }
      }

      if (isInside) {
         for (let i = 0; i < connectedNodes.length; i++) {
            const nodeIndex = connectedNodes[i];
            insideNodeIndexes.add(nodeIndex);
         }

         // Mark all encountered buildings
         for (const nodeIndex of encounteredOccupiedNodeIndexes) {
            const entityID = occupiedNodeToEntityIDRecord[nodeIndex];
            containedBuildingIDs.add(entityID);
         }
      }
   }

   // Find border nodes
   const borderNodes = new Set<SafetyNodeIndex>();
   for (const nodeIndex of occupiedNodeIndexes) {
      const nodeX = nodeIndex % SettingsConst.SAFETY_NODES_IN_WORLD_WIDTH;
      const nodeY = Math.floor(nodeIndex / SettingsConst.SAFETY_NODES_IN_WORLD_WIDTH);

      // Top
      if (nodeY < SettingsConst.SAFETY_NODES_IN_WORLD_WIDTH - 1) {
         const nodeIndex = getSafetyNodeIndex(nodeX, nodeY + 1);
         if (!occupiedNodeIndexes.has(nodeIndex) && !insideNodeIndexes.has(nodeIndex)) {
            borderNodes.add(nodeIndex);
         }
      }

      // Right
      if (nodeX < SettingsConst.SAFETY_NODES_IN_WORLD_WIDTH - 1) {
         const nodeIndex = getSafetyNodeIndex(nodeX + 1, nodeY);
         if (!occupiedNodeIndexes.has(nodeIndex) && !insideNodeIndexes.has(nodeIndex)) {
            borderNodes.add(nodeIndex);
         }
      }

      // Bottom
      if (nodeY > 0) {
         const nodeIndex = getSafetyNodeIndex(nodeX, nodeY - 1);
         if (!occupiedNodeIndexes.has(nodeIndex) && !insideNodeIndexes.has(nodeIndex)) {
            borderNodes.add(nodeIndex);
         }
      }

      // Left
      if (nodeX > 0) {
         const nodeIndex = getSafetyNodeIndex(nodeX - 1, nodeY);
         if (!occupiedNodeIndexes.has(nodeIndex) && !insideNodeIndexes.has(nodeIndex)) {
            borderNodes.add(nodeIndex);
         }
      }
   }

   // Create padding nodes
   let previousOuterNodes = borderNodes;
   const paddingNodeIndexes = new Set(borderNodes);
   for (let i = 0; i < Vars.BORDER_PADDING; i++) {
      // 
      // Expand previous outer nodes
      // 

      const addedNodes = new Set<SafetyNodeIndex>();
      
      for (const nodeIndex of previousOuterNodes) {
         const nodeX = nodeIndex % SettingsConst.SAFETY_NODES_IN_WORLD_WIDTH;
         const nodeY = Math.floor(nodeIndex / SettingsConst.SAFETY_NODES_IN_WORLD_WIDTH);

         // Top
         if (nodeY < SettingsConst.SAFETY_NODES_IN_WORLD_WIDTH - 1) {
            const nodeIndex = getSafetyNodeIndex(nodeX, nodeY + 1);
            if (!occupiedNodeIndexes.has(nodeIndex) && !paddingNodeIndexes.has(nodeIndex)) {
               paddingNodeIndexes.add(nodeIndex);
               addedNodes.add(nodeIndex);
            }
         }
   
         // Right
         if (nodeX < SettingsConst.SAFETY_NODES_IN_WORLD_WIDTH - 1) {
            const nodeIndex = getSafetyNodeIndex(nodeX + 1, nodeY);
            if (!occupiedNodeIndexes.has(nodeIndex) && !paddingNodeIndexes.has(nodeIndex)) {
               paddingNodeIndexes.add(nodeIndex);
               addedNodes.add(nodeIndex);
            }
         }
   
         // Bottom
         if (nodeY > 0) {
            const nodeIndex = getSafetyNodeIndex(nodeX, nodeY - 1);
            if (!occupiedNodeIndexes.has(nodeIndex) && !paddingNodeIndexes.has(nodeIndex)) {
               paddingNodeIndexes.add(nodeIndex);
               addedNodes.add(nodeIndex);
            }
         }
   
         // Left
         if (nodeX > 0) {
            const nodeIndex = getSafetyNodeIndex(nodeX - 1, nodeY);
            if (!occupiedNodeIndexes.has(nodeIndex) && !paddingNodeIndexes.has(nodeIndex)) {
               paddingNodeIndexes.add(nodeIndex);
               addedNodes.add(nodeIndex);
            }
         }
      }

      previousOuterNodes = addedNodes;
   }
   
   const nodes = new Array<SafetyNode>();
   const nodeRecord: Record<number, SafetyNode> = {};

   // Add the padding nodes
   for (const nodeIndex of paddingNodeIndexes) {
      const nodeX = nodeIndex % SettingsConst.SAFETY_NODES_IN_WORLD_WIDTH;
      const nodeY = Math.floor(nodeIndex / SettingsConst.SAFETY_NODES_IN_WORLD_WIDTH);

      const node: SafetyNode = {
         x: nodeX,
         y: nodeY,
         safety: 0
      };
      nodes.push(node);
      nodeRecord[nodeIndex] = node;
   }

   const remainingNodes = new Array<SafetyNodeIndex>;
   for (const nodeIndex of occupiedNodeIndexes) {
      remainingNodes.push(nodeIndex);
   }
   for (const nodeIndex of insideNodeIndexes) {
      remainingNodes.push(nodeIndex);
   }
   
   // Calculate contained nodes vulnerability
   const surroundingNodes = new Array<SafetyNodeIndex>();
   for (const nodeIndex of borderNodes) {
      surroundingNodes.push(nodeIndex);
   }
   while (remainingNodes.length > 0) {
      // @Incomplete: Don't assume all occupied nodes are safe
      
      // @Speed
      // find the surrounding node with the smallest safety
      let minSafety = Number.MAX_SAFE_INTEGER;
      let currentNodeIdx = 0;
      for (let i = 0; i < surroundingNodes.length; i++) {
         const node = surroundingNodes[i];
         const safety = nodeRecord[node].safety;
         if (safety < minSafety) {
            minSafety = safety;
            currentNodeIdx = i;
         }
      }

      const currentNode = surroundingNodes[currentNodeIdx];
      surroundingNodes.splice(currentNodeIdx, 1);

      const nodeX = currentNode % SettingsConst.SAFETY_NODES_IN_WORLD_WIDTH;
      const nodeY = Math.floor(currentNode / SettingsConst.SAFETY_NODES_IN_WORLD_WIDTH);

      // Top
      if (nodeY < SettingsConst.SAFETY_NODES_IN_WORLD_WIDTH - 1) {
         const nodeIndex = getSafetyNodeIndex(nodeX, nodeY + 1);
         const idx = remainingNodes.indexOf(nodeIndex);
         if (idx !== -1) {
            const node: SafetyNode = {
               x: nodeX,
               y: nodeY + 1,
               safety: calculateNodeSafety(minSafety, occupiedNodeIndexes.has(nodeIndex))
            };
            nodes.push(node);
            nodeRecord[nodeIndex] = node;
            surroundingNodes.push(nodeIndex);
            remainingNodes.splice(idx, 1);
         }
      }

      // Right
      if (nodeX < SettingsConst.SAFETY_NODES_IN_WORLD_WIDTH - 1) {
         const nodeIndex = getSafetyNodeIndex(nodeX + 1, nodeY);
         const idx = remainingNodes.indexOf(nodeIndex);
         if (idx !== -1) {
            const node: SafetyNode = {
               x: nodeX + 1,
               y: nodeY,
               safety: calculateNodeSafety(minSafety, occupiedNodeIndexes.has(nodeIndex))
            };
            nodes.push(node);
            nodeRecord[nodeIndex] = node;
            surroundingNodes.push(nodeIndex);
            remainingNodes.splice(idx, 1);
         }
      }

      // Bottom
      if (nodeY > 0) {
         const nodeIndex = getSafetyNodeIndex(nodeX, nodeY - 1);
         const idx = remainingNodes.indexOf(nodeIndex);
         if (idx !== -1) {
            const node: SafetyNode = {
               x: nodeX,
               y: nodeY - 1,
               safety: calculateNodeSafety(minSafety, occupiedNodeIndexes.has(nodeIndex))
            };
            nodes.push(node);
            nodeRecord[nodeIndex] = node;
            surroundingNodes.push(nodeIndex);
            remainingNodes.splice(idx, 1);
         }
      }

      // Left
      if (nodeX > 0) {
         const nodeIndex = getSafetyNodeIndex(nodeX - 1, nodeY);
         const idx = remainingNodes.indexOf(nodeIndex);
         if (idx !== -1) {
            const node: SafetyNode = {
               x: nodeX - 1,
               y: nodeY,
               safety: calculateNodeSafety(minSafety, occupiedNodeIndexes.has(nodeIndex))
            };
            nodes.push(node);
            nodeRecord[nodeIndex] = node;
            surroundingNodes.push(nodeIndex);
            remainingNodes.splice(idx, 1);
         }
      }
   }

   weightNodeDistances(nodeRecord, previousOuterNodes);
   
   tribe.safetyNodes = nodes;
   tribe.safetyNodeRecord = nodeRecord;
   tribe.occupiedSafetyNodes = occupiedNodeIndexes;
   tribe.containedBuildingIDs = containedBuildingIDs;
   tribe.insideNodes = insideNodeIndexes;
   tribe.occupiedNodeToEntityIDRecord = occupiedNodeToEntityIDRecord;
}

export function tickTribes(): void {
   for (let i = 0; i < Board.tribes.length; i++) {
      const tribe = Board.tribes[i];
      
      const buildingsAreDirty = tribe.buildingsAreDirty;
      
      // Update safety nodes
      if (tribe.buildingsAreDirty) {
         const occupiedNodesInfo = getOccupiedNodesInfo(tribe);
         updateTribeSafetyNodes(tribe, occupiedNodesInfo.occupiedNodeIndexes, occupiedNodesInfo.occupiedNodeToEntityIDRecord);

         tribe.buildingsAreDirty = false;
      }

      // Update restricted areas
      for (let i = 0; i < tribe.restrictedBuildingAreas.length; i++) {
         const restrictedArea = tribe.restrictedBuildingAreas[i];
         if (!Board.entityRecord.hasOwnProperty(restrictedArea.associatedBuildingID)) {
            tribe.restrictedBuildingAreas.splice(i, 1);
            i--;
         }
      }

      updateTribeNextBuilding(tribe, buildingsAreDirty);
      
      if (Board.ticks % SettingsConst.TPS === 0) {
         // @Cleanup: Not related to tribe building
         tribe.updateAvailableResources();
      }
   }
}

// @Cleanup: Copy and paste
const addTileNodePositions = (placeCandidate: WallPlaceCandidate, occupiedNodeIndexes: Set<SafetyNodeIndex>): void => {
   const minX = placeCandidate.position.x - SettingsConst.TILE_SIZE * 0.5;
   const maxX = placeCandidate.position.x + SettingsConst.TILE_SIZE * 0.5;
   const minY = placeCandidate.position.y - SettingsConst.TILE_SIZE * 0.5;
   const maxY = placeCandidate.position.y + SettingsConst.TILE_SIZE * 0.5;

   const rectPosX = placeCandidate.position.x;
   const rectPosY = placeCandidate.position.y;
   
   // @Speed: Math.round might also work
   const minNodeX = Math.max(Math.floor(minX / SettingsConst.SAFETY_NODE_SEPARATION), 0);
   const maxNodeX = Math.min(Math.ceil(maxX / SettingsConst.SAFETY_NODE_SEPARATION), SettingsConst.SAFETY_NODES_IN_WORLD_WIDTH - 1);
   const minNodeY = Math.max(Math.floor(minY / SettingsConst.SAFETY_NODE_SEPARATION), 0);
   const maxNodeY = Math.min(Math.ceil(maxY / SettingsConst.SAFETY_NODE_SEPARATION), SettingsConst.SAFETY_NODES_IN_WORLD_WIDTH - 1);

   for (let nodeX = minNodeX; nodeX <= maxNodeX; nodeX++) {
      for (let nodeY = minNodeY; nodeY <= maxNodeY; nodeY++) {
         const x = nodeX * SettingsConst.SAFETY_NODE_SEPARATION;
         const y = nodeY * SettingsConst.SAFETY_NODE_SEPARATION;
         if (pointIsInRectangle(x, y, rectPosX, rectPosY, SettingsConst.TILE_SIZE, SettingsConst.TILE_SIZE, placeCandidate.rotation)) {
            const nodeIndex = getSafetyNodeIndex(nodeX, nodeY);
            occupiedNodeIndexes.add(nodeIndex);
         }
      }
   }
}

const entityCollidesWithWall = (x: number, y: number, wallRotation: number, entity: Entity, wallVertexOffsets: HitboxVertexPositions): boolean => {
   for (let i = 0; i < entity.hitboxes.length; i++) {
      const hitbox = entity.hitboxes[i];
      // @Cleanup: copy and paste
      if (hitbox.hasOwnProperty("radius")) {
         if (circleAndRectangleDoIntersect(hitbox.x, hitbox.y, (hitbox as CircularHitbox).radius, x, y, SettingsConst.TILE_SIZE, SettingsConst.TILE_SIZE, wallRotation)) {
            return true;
         }
      } else {
         const sinRotation = Math.sin(wallRotation);
         const cosRotation = Math.cos(wallRotation);
         if (rectanglePointsDoIntersect(wallVertexOffsets, (hitbox as RectangularHitbox).vertexOffsets, x, y, hitbox.x, hitbox.y, cosRotation, -sinRotation, (hitbox as RectangularHitbox).axisX, (hitbox as RectangularHitbox).axisY)) {
            return true;
         }
      }
   }

   return false;
}

const wallSpaceIsFree = (x: number, y: number, wallRotation: number, tribe: Tribe): boolean => {
   // @Speed: Can do a constant smaller than tile size
   const minChunkX = Math.max(Math.floor((x - SettingsConst.TILE_SIZE) / SettingsConst.CHUNK_UNITS), 0);
   const maxChunkX = Math.min(Math.floor((x + SettingsConst.TILE_SIZE) / SettingsConst.CHUNK_UNITS), SettingsConst.BOARD_SIZE - 1);
   const minChunkY = Math.max(Math.floor((y - SettingsConst.TILE_SIZE) / SettingsConst.CHUNK_UNITS), 0);
   const maxChunkY = Math.min(Math.floor((y + SettingsConst.TILE_SIZE) / SettingsConst.CHUNK_UNITS), SettingsConst.BOARD_SIZE - 1);

   const sinRotation = Math.sin(wallRotation);
   const cosRotation = Math.cos(wallRotation);

   const x2 = SettingsConst.TILE_SIZE * 0.499;
   const x1 = -x2;
   const y2 = SettingsConst.TILE_SIZE * 0.499;
   
   const topLeftX = cosRotation * x1 + sinRotation * y2;
   const topLeftY = cosRotation * y2 - sinRotation * x1;
   const topRightX = cosRotation * x2 + sinRotation * y2;
   const topRightY = cosRotation * y2 - sinRotation * x2;

   const wallVertexOffsets: HitboxVertexPositions = [
      new Point(topLeftX, topLeftY),
      new Point(topRightX, topRightY),
      new Point(-topLeftX, -topLeftY),
      new Point(-topRightX, -topRightY)
   ];
   
   // Check for existing walls
   for (let chunkX = minChunkX; chunkX <= maxChunkX; chunkX++) {
      for (let chunkY = minChunkY; chunkY <= maxChunkY; chunkY++) {
         const chunk = Board.getChunk(chunkX, chunkY);

         for (let i = 0; i < chunk.entities.length; i++) {
            const entity = chunk.entities[i];
            if (tribe.buildings.indexOf(entity) === -1) {
               continue;
            }
      
            if (entityCollidesWithWall(x, y, wallRotation, entity, wallVertexOffsets)) {
               return false;
            }
         }
      }
   }

   // Check for restricted areas
   for (let i = 0; i < tribe.restrictedBuildingAreas.length; i++) {
      const restrictedArea = tribe.restrictedBuildingAreas[i];

      if (rectanglePointsDoIntersect(wallVertexOffsets, restrictedArea.vertexOffsets, x, y, restrictedArea.x, restrictedArea.y, cosRotation, -sinRotation, Math.sin(restrictedArea.rotation), Math.cos(restrictedArea.rotation))) {
         return false;
      }
   }

   return true;
}

interface WallPlaceCandidate {
   readonly position: Point;
   readonly rotation: number;
   readonly isSnappedToWall: boolean;
}

const addGridAlignedWallCandidates = (tribe: Tribe, placeCandidates: Array<WallPlaceCandidate>): void => {
   const occupiedNodeIndexes = new Set<SafetyNodeIndex>();
   for (let i = 0; i < tribe.buildings.length; i++) {
      const building = tribe.buildings[i];
      addEntityVulnerabilityNodePositions(building, occupiedNodeIndexes, {});

   }
   for (let i = 0; i < tribe.restrictedBuildingAreas.length; i++) {
      const restrictedArea = tribe.restrictedBuildingAreas[i];

      let minX = Number.MAX_SAFE_INTEGER;
      let maxX = Number.MIN_SAFE_INTEGER;
      let minY = Number.MAX_SAFE_INTEGER;
      let maxY = Number.MIN_SAFE_INTEGER;
      for (let i = 0; i < 4; i++) {
         const offset = restrictedArea.vertexOffsets[i];
         if (offset.x < minX) {
            minX = offset.x;
         }
         if (offset.x > maxX) {
            maxX = offset.x;
         }
         if (offset.y < minY) {
            minY = offset.y;
         }
         if (offset.y > maxY) {
            maxY = offset.y;
         }
      }
      
      addRectangularNodePositions(0, restrictedArea.x, restrictedArea.y, restrictedArea.width, restrictedArea.height, restrictedArea.rotation, minX, maxX, minY, maxY, occupiedNodeIndexes, {});
   }

   // Convert to occupied tile indexes
   const occupiedTileIndexes = new Set<number>();
   for (const nodeIndex of occupiedNodeIndexes) {
      const nodeX = nodeIndex % SettingsConst.SAFETY_NODES_IN_WORLD_WIDTH;
      const nodeY = Math.floor(nodeIndex / SettingsConst.SAFETY_NODES_IN_WORLD_WIDTH);

      const tileX = Math.floor(nodeX * SettingsConst.SAFETY_NODE_SEPARATION / SettingsConst.TILE_SIZE);
      const tileY = Math.floor(nodeY * SettingsConst.SAFETY_NODE_SEPARATION / SettingsConst.TILE_SIZE);

      const tileIndex = tileY * SettingsConst.TILES_IN_WORLD_WIDTH + tileX;
      occupiedTileIndexes.add(tileIndex);
   }

   // Find border tiles
   const borderTileIndexes = new Set<number>();
   for (const tileIndex of occupiedTileIndexes) {
      const tileX = tileIndex % SettingsConst.TILES_IN_WORLD_WIDTH;
      const tileY = Math.floor(tileIndex / SettingsConst.TILES_IN_WORLD_WIDTH);

      // Top
      if (tileY < SettingsConst.TILES_IN_WORLD_WIDTH - 1) {
         const tileIndex = (tileY + 1) * SettingsConst.TILES_IN_WORLD_WIDTH + tileX;
         if (!occupiedTileIndexes.has(tileIndex)) {
            borderTileIndexes.add(tileIndex);
         }
      }

      // Right
      if (tileX < SettingsConst.TILES_IN_WORLD_WIDTH - 1) {
         const tileIndex = tileY * SettingsConst.TILES_IN_WORLD_WIDTH + tileX + 1;
         if (!occupiedTileIndexes.has(tileIndex)) {
            borderTileIndexes.add(tileIndex);
         }
      }

      // Bottom
      if (tileY > 0) {
         const tileIndex = (tileY - 1) * SettingsConst.TILES_IN_WORLD_WIDTH + tileX;
         if (!occupiedTileIndexes.has(tileIndex)) {
            borderTileIndexes.add(tileIndex);
         }
      }

      // Left
      if (tileX > 0) {
         const tileIndex = tileY * SettingsConst.TILES_IN_WORLD_WIDTH + tileX - 1;
         if (!occupiedTileIndexes.has(tileIndex)) {
            borderTileIndexes.add(tileIndex);
         }
      }
   }

   // Expand tile indexes
   // @Speed
   let previousOuterTileIndexes = borderTileIndexes;
   for (let i = 0; i < 2; i++) {
      const addedTileIndexes = new Set<SafetyNodeIndex>();
      
      for (const tileIndex of previousOuterTileIndexes) {
         const tileX = tileIndex % SettingsConst.TILES_IN_WORLD_WIDTH;
         const tileY = Math.floor(tileIndex / SettingsConst.TILES_IN_WORLD_WIDTH);

         // Top
         if (tileY < SettingsConst.SAFETY_NODES_IN_WORLD_WIDTH - 1) {
            const tileIndex = (tileY + 1) * SettingsConst.TILES_IN_WORLD_WIDTH + tileX;
            if (!occupiedTileIndexes.has(tileIndex)) {
               occupiedTileIndexes.add(tileIndex);
               addedTileIndexes.add(tileIndex);
            }
         }
   
         // Right
         if (tileX < SettingsConst.SAFETY_NODES_IN_WORLD_WIDTH - 1) {
            const tileIndex = tileY * SettingsConst.TILES_IN_WORLD_WIDTH + tileX + 1;
            if (!occupiedTileIndexes.has(tileIndex)) {
               occupiedTileIndexes.add(tileIndex);
               addedTileIndexes.add(tileIndex);
            }
         }
   
         // Bottom
         if (tileY > 0) {
            const tileIndex = (tileY - 1) * SettingsConst.TILES_IN_WORLD_WIDTH + tileX;
            if (!occupiedTileIndexes.has(tileIndex)) {
               occupiedTileIndexes.add(tileIndex);
               addedTileIndexes.add(tileIndex);
            }
         }
   
         // Left
         if (tileX > 0) {
            const tileIndex = tileY * SettingsConst.TILES_IN_WORLD_WIDTH + tileX - 1;
            if (!occupiedTileIndexes.has(tileIndex)) {
               occupiedTileIndexes.add(tileIndex);
               addedTileIndexes.add(tileIndex);
            }
         }
      }

      previousOuterTileIndexes = addedTileIndexes;
   }

   // Filter candidates
   for (const tileIndex of occupiedTileIndexes) {
      const tileX = tileIndex % SettingsConst.TILES_IN_WORLD_WIDTH;
      const tileY = Math.floor(tileIndex / SettingsConst.TILES_IN_WORLD_WIDTH);

      const x = (tileX + 0.5) * SettingsConst.TILE_SIZE;
      const y = (tileY + 0.5) * SettingsConst.TILE_SIZE;
      if (!wallSpaceIsFree(x, y, 0, tribe)) {
         continue;
      }
      
      placeCandidates.push({
         position: new Point(x, y),
         rotation: 0,
         isSnappedToWall: false
      });
   }
}

const addSnappedWallCandidates = (tribe: Tribe, placeCandidates: Array<WallPlaceCandidate>): void => {
   const seenEntityIDs = new Set<number>();

   for (let i = 0; i < tribe.buildings.length; i++) {
      const building = tribe.buildings[i];

      const minX = building.boundingAreaMinX - Vars.WALL_SNAP_SEARCH_DISTANCE - 64;
      const maxX = building.boundingAreaMaxX + Vars.WALL_SNAP_SEARCH_DISTANCE + 64;
      const minY = building.boundingAreaMinY - Vars.WALL_SNAP_SEARCH_DISTANCE - 64;
      const maxY = building.boundingAreaMaxY + Vars.WALL_SNAP_SEARCH_DISTANCE + 64;

      const minChunkX = Math.max(Math.floor(minX / SettingsConst.CHUNK_UNITS), 0);
      const maxChunkX = Math.min(Math.floor(maxX / SettingsConst.CHUNK_UNITS), SettingsConst.BOARD_SIZE - 1);
      const minChunkY = Math.max(Math.floor(minY / SettingsConst.CHUNK_UNITS), 0);
      const maxChunkY = Math.min(Math.floor(maxY / SettingsConst.CHUNK_UNITS), SettingsConst.BOARD_SIZE - 1);

      for (let chunkX = minChunkX; chunkX <= maxChunkX; chunkX++) {
         for (let chunkY = minChunkY; chunkY <= maxChunkY; chunkY++) {
            const chunk = Board.getChunk(chunkX, chunkY);

            for (let i = 0; i < chunk.entities.length; i++) {
               const entity = chunk.entities[i];
               if ((entity.type !== IEntityType.wall) || seenEntityIDs.has(entity.id)) {
                  continue;
               }
               seenEntityIDs.add(entity.id);
               
               for (let i = 0; i < 4; i++) {
                  const offsetDirection = entity.rotation + i * Math.PI / 2;
                  const x = entity.position.x + 64 * Math.sin(offsetDirection);
                  const y = entity.position.y + 64 * Math.cos(offsetDirection);

                  const distance = getDistanceFromPointToEntity(x, y, building);
                  if (distance <= Vars.WALL_SNAP_SEARCH_DISTANCE && wallSpaceIsFree(x, y, entity.rotation, tribe)) {
                     placeCandidates.push({
                        position: new Point(x, y),
                        rotation: entity.rotation,
                        isSnappedToWall: true
                     });
                  }
               }
            }
         }
      }
   }
}

const getWallPlaceCandidates = (tribe: Tribe): ReadonlyArray<WallPlaceCandidate> => {
   const placeCandidates = new Array<WallPlaceCandidate>();

   addGridAlignedWallCandidates(tribe, placeCandidates);
   addSnappedWallCandidates(tribe, placeCandidates);
   
   return placeCandidates;
}

interface WallPlaceQueryResults {
   readonly plan: BuildingPlan | null;
   readonly potentialPlans: ReadonlyArray<PotentialBuildingPlanData>;
}

const getExtendedOccupiedNodes = (occupiedNodeIndexes: Set<SafetyNodeIndex>): Set<SafetyNodeIndex> => {
   // Find border nodes
   const borderNodeIndexes = new Set<number>();
   for (const nodeIndex of occupiedNodeIndexes) {
      const nodeX = nodeIndex % SettingsConst.SAFETY_NODES_IN_WORLD_WIDTH;
      const nodeY = Math.floor(nodeIndex / SettingsConst.SAFETY_NODES_IN_WORLD_WIDTH);

      // Top
      if (nodeY < SettingsConst.SAFETY_NODES_IN_WORLD_WIDTH - 1) {
         const nodeIndex = getSafetyNodeIndex(nodeX, nodeY + 1);
         if (!occupiedNodeIndexes.has(nodeIndex)) {
            borderNodeIndexes.add(nodeIndex);
         }
      }

      // Right
      if (nodeX < SettingsConst.SAFETY_NODES_IN_WORLD_WIDTH - 1) {
         const nodeIndex = getSafetyNodeIndex(nodeX + 1, nodeY);
         if (!occupiedNodeIndexes.has(nodeIndex)) {
            borderNodeIndexes.add(nodeIndex);
         }
      }

      // Bottom
      if (nodeY > 0) {
         const nodeIndex = getSafetyNodeIndex(nodeX, nodeY - 1);
         if (!occupiedNodeIndexes.has(nodeIndex)) {
            borderNodeIndexes.add(nodeIndex);
         }
      }

      // Left
      if (nodeX > 0) {
         const nodeIndex = getSafetyNodeIndex(nodeX - 1, nodeY);
         if (!occupiedNodeIndexes.has(nodeIndex)) {
            borderNodeIndexes.add(nodeIndex);
         }
      }
   }

   const expandedNodeIndexes = new Set<SafetyNodeIndex>();
   for (const nodeIndex of occupiedNodeIndexes) {
      expandedNodeIndexes.add(nodeIndex);
   }
   
   // Expand nodes
   let previousOuterNodes = borderNodeIndexes;
   for (let i = 0; i < 5; i++) {
      // 
      // Expand previous outer nodes
      // 

      const addedNodes = new Set<SafetyNodeIndex>();
      
      for (const nodeIndex of previousOuterNodes) {
         const nodeX = nodeIndex % SettingsConst.SAFETY_NODES_IN_WORLD_WIDTH;
         const nodeY = Math.floor(nodeIndex / SettingsConst.SAFETY_NODES_IN_WORLD_WIDTH);

         // Top
         if (nodeY < SettingsConst.SAFETY_NODES_IN_WORLD_WIDTH - 1) {
            const nodeIndex = getSafetyNodeIndex(nodeX, nodeY + 1);
            if (!expandedNodeIndexes.has(nodeIndex)) {
               expandedNodeIndexes.add(nodeIndex);
               addedNodes.add(nodeIndex);
            }
         }
   
         // Right
         if (nodeX < SettingsConst.SAFETY_NODES_IN_WORLD_WIDTH - 1) {
            const nodeIndex = getSafetyNodeIndex(nodeX + 1, nodeY);
            if (!expandedNodeIndexes.has(nodeIndex)) {
               expandedNodeIndexes.add(nodeIndex);
               addedNodes.add(nodeIndex);
            }
         }
   
         // Bottom
         if (nodeY > 0) {
            const nodeIndex = getSafetyNodeIndex(nodeX, nodeY - 1);
            if (!expandedNodeIndexes.has(nodeIndex)) {
               expandedNodeIndexes.add(nodeIndex);
               addedNodes.add(nodeIndex);
            }
         }
   
         // Left
         if (nodeX > 0) {
            const nodeIndex = getSafetyNodeIndex(nodeX - 1, nodeY);
            if (!expandedNodeIndexes.has(nodeIndex)) {
               expandedNodeIndexes.add(nodeIndex);
               addedNodes.add(nodeIndex);
            }
         }
      }

      previousOuterNodes = addedNodes;
   }

   return expandedNodeIndexes;
}

const findIdealWallPlacePosition = (tribe: Tribe): WallPlaceQueryResults => {
   const potentialCandidates = getWallPlaceCandidates(tribe);
   if (potentialCandidates.length === 0) {
      // Unable to find a position
      return {
         potentialPlans: [],
         plan:  null
      };
   }

   const realNodes = tribe.safetyNodes;
   const realNodeRecord = tribe.safetyNodeRecord;
   const realOccupiedNodes = tribe.occupiedSafetyNodes;
   const realInsideNodes = tribe.insideNodes;
   const realContainedBuildingIDs = tribe.containedBuildingIDs;

   const potentialPlans = new Array<PotentialBuildingPlanData>();
   
   // 
   // Simulate placing each position to see which one increases safety the most
   // 

   let maxSafety = -1;
   let bestCandidate!: WallPlaceCandidate;
   for (let i = 0; i < potentialCandidates.length; i++) {
      const candidate = potentialCandidates[i];

      const occupiedNodesInfo = getOccupiedNodesInfo(tribe);
      addTileNodePositions(candidate, occupiedNodesInfo.occupiedNodeIndexes);

      updateTribeSafetyNodes(tribe, occupiedNodesInfo.occupiedNodeIndexes, occupiedNodesInfo.occupiedNodeToEntityIDRecord);

      const query = getTribeSafety(tribe);
      const safety = query.safety;

      if (safety > maxSafety) {
         maxSafety = safety;
         bestCandidate = candidate;
      }

      potentialPlans.push({
         x: candidate.position.x,
         y: candidate.position.y,
         rotation: candidate.rotation,
         buildingType: IEntityType.wall,
         safety: safety,
         safetyInfo: query.safetyInfo
      });

      // Reset back to real nodes
      tribe.safetyNodes = realNodes;
      tribe.safetyNodeRecord = realNodeRecord;
      tribe.occupiedSafetyNodes = realOccupiedNodes;
      tribe.insideNodes = realInsideNodes;
      tribe.containedBuildingIDs = realContainedBuildingIDs;
   }
   
   return {
      plan: {
         position: bestCandidate.position,
         rotation: bestCandidate.rotation,
         buildingRecipe: getItemRecipe(ItemType.wooden_wall)!,
         assignedTribesmanID: 0
      },
      potentialPlans: potentialPlans
   };
}

const planIsInvalid = (tribe: Tribe, plan: BuildingPlan): boolean => {
   const entityType = (ITEM_INFO_RECORD[plan.buildingRecipe.product] as PlaceableItemInfo).entityTypeConst;
   
   const hitboxes = createBuildingHitboxes(entityType, plan.position.x, plan.position.y, 1, plan.rotation);

   const firstHitbox = hitboxes[0];
   let minX = firstHitbox.calculateHitboxBoundsMinX();
   let maxX = firstHitbox.calculateHitboxBoundsMaxX();
   let minY = firstHitbox.calculateHitboxBoundsMinY();
   let maxY = firstHitbox.calculateHitboxBoundsMaxY();
   for (let i = 1; i < hitboxes.length; i++) {
      const hitbox = hitboxes[i];

      const hitboxMinX = hitbox.calculateHitboxBoundsMinX();
      const hitboxMaxX = hitbox.calculateHitboxBoundsMaxX();
      const hitboxMinY = hitbox.calculateHitboxBoundsMinY();
      const hitboxMaxY = hitbox.calculateHitboxBoundsMaxY();

      if (hitboxMinX < minX) {
         minX = hitboxMinX;
      }
      if (hitboxMaxX > maxX) {
         maxX = hitboxMinX;
      }
      if (hitboxMinY < minY) {
         minY = hitboxMinY;
      }
      if (hitboxMaxY > minY) {
         maxY = hitboxMaxY;
      }
   }

   const minChunkX = Math.max(Math.floor(minX / SettingsConst.CHUNK_UNITS), 0);
   const maxChunkX = Math.min(Math.floor(maxX / SettingsConst.CHUNK_UNITS), SettingsConst.BOARD_SIZE - 1);
   const minChunkY = Math.max(Math.floor(minY / SettingsConst.CHUNK_UNITS), 0);
   const maxChunkY = Math.min(Math.floor(maxY / SettingsConst.CHUNK_UNITS), SettingsConst.BOARD_SIZE - 1);
   
   // Check which entities are colliding
   for (let chunkX = minChunkX; chunkX <= maxChunkX; chunkX++) {
      for (let chunkY = minChunkY; chunkY <= maxChunkY; chunkY++) {
         const chunk = Board.getChunk(chunkX, chunkY);
         for (let i = 0; i < chunk.entities.length; i++) {
            const entity = chunk.entities[i];
            if (tribe.buildings.indexOf(entity) === -1) {
               continue;
            }

            for (let j = 0; j < hitboxes.length; j++) {
               const hitbox = hitboxes[j];

               for (let k = 0; k < entity.hitboxes.length; k++) {
                  const entityHitbox = entity.hitboxes[k];

                  if (hitbox.isColliding(entityHitbox)) {
                     return true;
                  }
               }
            }
         }
      }
   }
   
   return false;
}

export function updateTribeNextBuilding(tribe: Tribe, buildingsAreDirty: boolean): void {
   // Priorities:
   // 1) Protect vulnerable buildings

   // If the buildings are dirty, always recalculate
   if (!buildingsAreDirty) {
      if (tribe.buildingPlan !== null) {
         // Make sure the plan is still valid
         if (planIsInvalid(tribe, tribe.buildingPlan)) {
            tribe.buildingPlan = null;
         } else {
            return;
         }
      }
   }
   
   // Protect buildings if vulnerable
   if (tribeIsVulnerable(tribe)) {
      // Find the place for a wall that would minimise the building's vulnerability
      const planQueryResults = findIdealWallPlacePosition(tribe);

      tribe.buildingPlan = planQueryResults.plan;
      tribe.potentialPlansData = planQueryResults.potentialPlans;
      return;
   }

   tribe.buildingPlan = null;
}