import { BuildingPlanData, BuildingVulnerabilityData, HitboxVertexPositions, IEntityType, ITEM_INFO_RECORD, ItemType, PlaceableItemInfo, Point, RestrictedBuildingAreaData, Settings, SettingsConst, VisibleChunkBounds, VulnerabilityNodeData, circleAndRectangleDoIntersect, distBetweenPointAndRectangle, distance, getItemRecipe, pointIsInRectangle, rectanglePointsDoIntersect } from "webgl-test-shared";
import Entity from "./Entity";
import Tribe, { BuildingPlan } from "./Tribe";
import CircularHitbox from "./hitboxes/CircularHitbox";
import RectangularHitbox from "./hitboxes/RectangularHitbox";
import Board from "./Board";
import { TribeComponentArray } from "./components/ComponentArray";
import { getDistanceFromPointToEntity } from "./ai-shared";
import { createBuildingHitboxes } from "./buildings";

const enum Vars {
   MAX_VULNERABILITY = 100,
   /** Base amount the vulnerability decreases when moving in a node */
   SAFE_DISTANCE_FALLOFF = 5,
   /** Falloff from distance from outside the padding */
   DISTANCE_FALLOFF = 2,
   OCCUPIED_NODE_WEIGHT = 10,
   BORDER_PADDING = 5,
   /** Maximum vulnerability that buildings can be placed in */
   MAX_SAFE_VULNERABILITY = 50,
   /** Distance that the AI will try to snap new walls to existing ones */
   WALL_SNAP_SEARCH_DISTANCE = 200,
   PLAN_COMPLETE_RANGE = 10
}

export type VulnerabilityNodeIndex = number;

// @Cleanup @Memory: Can remove x and y.
// @Cleanup: Might be able to just make into number
export interface VulnerabilityNode {
   readonly x: number;
   readonly y: number;
   vulnerability: number;
};

const getNodeIndex = (nodeX: number, nodeY: number): VulnerabilityNodeIndex => {
   return nodeY * SettingsConst.VULNERABILITY_NODES_IN_WORLD_WIDTH + nodeX;
}

const addCircularHitboxNodePositions = (entityID: number, hitbox: CircularHitbox, positions: Set<VulnerabilityNodeIndex>, occupiedNodeToEntityIDRecord: Record<VulnerabilityNodeIndex, number>): void => {
   const minX = hitbox.calculateHitboxBoundsMinX();
   const maxX = hitbox.calculateHitboxBoundsMaxX();
   const minY = hitbox.calculateHitboxBoundsMinY();
   const maxY = hitbox.calculateHitboxBoundsMaxY();

   const centerX = hitbox.x / SettingsConst.VULNERABILITY_NODE_SEPARATION;
   const centerY = hitbox.y / SettingsConst.VULNERABILITY_NODE_SEPARATION;
   
   const minNodeX = Math.max(Math.floor(minX / SettingsConst.VULNERABILITY_NODE_SEPARATION), 0);
   const maxNodeX = Math.min(Math.ceil(maxX / SettingsConst.VULNERABILITY_NODE_SEPARATION), SettingsConst.VULNERABILITY_NODES_IN_WORLD_WIDTH - 1);
   const minNodeY = Math.max(Math.floor(minY / SettingsConst.VULNERABILITY_NODE_SEPARATION), 0);
   const maxNodeY = Math.min(Math.ceil(maxY / SettingsConst.VULNERABILITY_NODE_SEPARATION), SettingsConst.VULNERABILITY_NODES_IN_WORLD_WIDTH - 1);

   const hitboxNodeRadius = hitbox.radius / SettingsConst.VULNERABILITY_NODE_SEPARATION + 0.5;
   const hitboxNodeRadiusSquared = hitboxNodeRadius * hitboxNodeRadius;

   for (let nodeX = minNodeX; nodeX <= maxNodeX; nodeX++) {
      for (let nodeY = minNodeY; nodeY <= maxNodeY; nodeY++) {
         const xDiff = nodeX - centerX;
         const yDiff = nodeY - centerY;
         if (xDiff * xDiff + yDiff * yDiff <= hitboxNodeRadiusSquared) {
            const nodeIndex = getNodeIndex(nodeX, nodeY);
            positions.add(nodeIndex);
            occupiedNodeToEntityIDRecord[nodeIndex] = entityID;
         }
      }
   }
}

const addRectangularHitboxNodePositions = (entityID: number, hitbox: RectangularHitbox, positions: Set<VulnerabilityNodeIndex>, occupiedNodeToEntityIDRecord: Record<VulnerabilityNodeIndex, number>): void => {
   const minX = hitbox.calculateHitboxBoundsMinX();
   const maxX = hitbox.calculateHitboxBoundsMaxX();
   const minY = hitbox.calculateHitboxBoundsMinY();
   const maxY = hitbox.calculateHitboxBoundsMaxY();

   const rectPosX = hitbox.x;
   const rectPosY = hitbox.y;
   
   // @Speed: Math.round might also work
   const minNodeX = Math.max(Math.floor(minX / SettingsConst.VULNERABILITY_NODE_SEPARATION), 0);
   const maxNodeX = Math.min(Math.ceil(maxX / SettingsConst.VULNERABILITY_NODE_SEPARATION), SettingsConst.VULNERABILITY_NODES_IN_WORLD_WIDTH - 1);
   const minNodeY = Math.max(Math.floor(minY / SettingsConst.VULNERABILITY_NODE_SEPARATION), 0);
   const maxNodeY = Math.min(Math.ceil(maxY / SettingsConst.VULNERABILITY_NODE_SEPARATION), SettingsConst.VULNERABILITY_NODES_IN_WORLD_WIDTH - 1);

   for (let nodeX = minNodeX; nodeX <= maxNodeX; nodeX++) {
      for (let nodeY = minNodeY; nodeY <= maxNodeY; nodeY++) {
         const x = nodeX * SettingsConst.VULNERABILITY_NODE_SEPARATION;
         const y = nodeY * SettingsConst.VULNERABILITY_NODE_SEPARATION;
         if (distBetweenPointAndRectangle(x, y, rectPosX, rectPosY, hitbox.width, hitbox.height, hitbox.rotation) <= SettingsConst.VULNERABILITY_NODE_SEPARATION * 0.5) {
            const nodeIndex = getNodeIndex(nodeX, nodeY);
            positions.add(nodeIndex);
            occupiedNodeToEntityIDRecord[nodeIndex] = entityID;
         }
      }
   }
}

const addEntityNodePositions = (entity: Entity, positions: Set<VulnerabilityNodeIndex>, occupiedNodeToEntityIDRecord: Record<VulnerabilityNodeIndex, number>): void => {
   for (let i = 0; i < entity.hitboxes.length; i++) {
      const hitbox = entity.hitboxes[i];

      // Add to occupied pathfinding nodes
      if (hitbox.hasOwnProperty("radius")) {
         addCircularHitboxNodePositions(entity.id, hitbox as CircularHitbox, positions, occupiedNodeToEntityIDRecord);
      } else {
         addRectangularHitboxNodePositions(entity.id, hitbox as RectangularHitbox, positions, occupiedNodeToEntityIDRecord);
      }
   }
}

interface OccupiedNodesInfo {
   readonly occupiedNodeIndexes: Set<VulnerabilityNodeIndex>;
   readonly occupiedNodeToEntityIDRecord: Record<VulnerabilityNodeIndex, number>;
}

const getOccupiedNodesInfo = (tribe: Tribe): OccupiedNodesInfo => {
   const positions = new Set<VulnerabilityNodeIndex>();
   const occupiedNodeToEntityIDRecord: Record<VulnerabilityNodeIndex, number> = {};

   // Add nodes from buildings
   for (let i = 0; i < tribe.buildings.length; i++) {
      const building = tribe.buildings[i];
      addEntityNodePositions(building, positions, occupiedNodeToEntityIDRecord);
   }
   
   return {
      occupiedNodeIndexes: positions,
      occupiedNodeToEntityIDRecord: occupiedNodeToEntityIDRecord
   };
}

/** Gets all nodes within the tribe's bounding area which aren't occupied */
const getAreaNodes = (occupiedNodeIndexes: Set<VulnerabilityNodeIndex>, minNodeX: number, maxNodeX: number, minNodeY: number, maxNodeY: number): Set<VulnerabilityNodeIndex> => {
   const area = new Set<VulnerabilityNodeIndex>();
   for (let nodeX = minNodeX; nodeX <= maxNodeX; nodeX++) {
      for (let nodeY = minNodeY; nodeY <= maxNodeY; nodeY++) {
         const nodeIndex = getNodeIndex(nodeX, nodeY);
         if (!occupiedNodeIndexes.has(nodeIndex)) {
            area.add(nodeIndex);
         }
      }
   }
   return area;
}

const weightNodeDistance = (node: VulnerabilityNode, dist: number): void => {
   node.vulnerability -= dist * Vars.DISTANCE_FALLOFF;
}

const weightNodeDistances = (nodeRecord: Record<number, VulnerabilityNode>, outmostPaddingNodes: Set<VulnerabilityNodeIndex>): void => {
   let dist = 0;
   
   const encounteredNodeIndexes = new Set<VulnerabilityNodeIndex>();
   for (const nodeIndex of outmostPaddingNodes) {
      encounteredNodeIndexes.add(nodeIndex);
   }
   
   let outmostNodes = outmostPaddingNodes;
   const numNodes = Object.keys(nodeRecord).length;
   while (encounteredNodeIndexes.size < numNodes) {
      const addedNodes = new Set<VulnerabilityNodeIndex>();

      for (const nodeIndex of outmostNodes) {
         const nodeX = nodeIndex % SettingsConst.VULNERABILITY_NODES_IN_WORLD_WIDTH;
         const nodeY = Math.floor(nodeIndex / SettingsConst.VULNERABILITY_NODES_IN_WORLD_WIDTH);

         // Top
         if (nodeY < SettingsConst.VULNERABILITY_NODES_IN_WORLD_WIDTH - 1) {
            const nodeIndex = getNodeIndex(nodeX, nodeY + 1);
            const node = nodeRecord[nodeIndex];
            if (!encounteredNodeIndexes.has(nodeIndex) && node !== undefined) {
               addedNodes.add(nodeIndex);
               encounteredNodeIndexes.add(nodeIndex);
               weightNodeDistance(node, dist);
            }
         }

         // Right
         if (nodeX < SettingsConst.VULNERABILITY_NODES_IN_WORLD_WIDTH - 1) {
            const nodeIndex = getNodeIndex(nodeX + 1, nodeY);
            const node = nodeRecord[nodeIndex];
            if (!encounteredNodeIndexes.has(nodeIndex) && node !== undefined) {
               addedNodes.add(nodeIndex);
               encounteredNodeIndexes.add(nodeIndex);
               weightNodeDistance(node, dist);
            }
         }

         // Bottom
         if (nodeY > 0) {
            const nodeIndex = getNodeIndex(nodeX, nodeY - 1);
            const node = nodeRecord[nodeIndex];
            if (!encounteredNodeIndexes.has(nodeIndex) && node !== undefined) {
               addedNodes.add(nodeIndex);
               encounteredNodeIndexes.add(nodeIndex);
               weightNodeDistance(node, dist);
            }
         }

         // Left
         if (nodeX > 0) {
            const nodeIndex = getNodeIndex(nodeX - 1, nodeY);
            const node = nodeRecord[nodeIndex];
            if (!encounteredNodeIndexes.has(nodeIndex) && node !== undefined) {
               addedNodes.add(nodeIndex);
               encounteredNodeIndexes.add(nodeIndex);
               weightNodeDistance(node, dist);
            }
         }
      }

      outmostNodes = addedNodes;
      dist++;
   }
}

const calculateNodeVulnerability = (maxAdjacentVulnerability: number, isOccupied: boolean): number => {
   let vulnerability = maxAdjacentVulnerability - Vars.SAFE_DISTANCE_FALLOFF;
   if (isOccupied) {
      vulnerability -= Vars.OCCUPIED_NODE_WEIGHT;
   }
   if (vulnerability < 0) {
      vulnerability = 0;
   }
   return vulnerability;
}

const updateTribeVulnerabilityNodes = (tribe: Tribe, occupiedNodeIndexes: Set<VulnerabilityNodeIndex>, occupiedNodeToEntityIDRecord: Record<VulnerabilityNodeIndex, number>): void => {
   // Find min and max node positions
   let minNodeX = SettingsConst.VULNERABILITY_NODES_IN_WORLD_WIDTH - 1;
   let maxNodeX = 0;
   let minNodeY = SettingsConst.VULNERABILITY_NODES_IN_WORLD_WIDTH - 1;
   let maxNodeY = 0;
   for (const nodeIndex of occupiedNodeIndexes) {
      const nodeX = nodeIndex % SettingsConst.VULNERABILITY_NODES_IN_WORLD_WIDTH;
      const nodeY = Math.floor(nodeIndex / SettingsConst.VULNERABILITY_NODES_IN_WORLD_WIDTH);

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
   const maxBorderNodeX = Math.min(maxNodeX + 1, SettingsConst.VULNERABILITY_NODES_IN_WORLD_WIDTH - 1);
   const minBorderNodeY = Math.max(minNodeY - 1, 0);
   const maxBorderNodeY = Math.min(maxNodeY + 1, SettingsConst.VULNERABILITY_NODES_IN_WORLD_WIDTH - 1);

   const areaNodes = getAreaNodes(occupiedNodeIndexes, minNodeX, maxNodeX, minNodeY, maxNodeY);

   // Find inside nodes and contained buildings
   const containedBuildingIDs = new Set<number>();
   const insideNodeIndexes = new Set<VulnerabilityNodeIndex>();
   while (areaNodes.size > 0) {
      // Start at the first element in the set
      let originNodeIndex!: VulnerabilityNodeIndex;
      for (const nodeIndex of areaNodes) {
         originNodeIndex = nodeIndex;
         break;
      }

      let isInside = true;
      const encounteredOccupiedNodeIndexes = new Set<VulnerabilityNodeIndex>();

      // @Speed: Span filling
      // Get all connected nodes
      const connectedNodes = [];
      const nodesToCheck = [originNodeIndex];
      while (nodesToCheck.length > 0) {
         const nodeIndex = nodesToCheck[0];
         const nodeX = nodeIndex % SettingsConst.VULNERABILITY_NODES_IN_WORLD_WIDTH;
         const nodeY = Math.floor(nodeIndex / SettingsConst.VULNERABILITY_NODES_IN_WORLD_WIDTH);

         connectedNodes.push(nodeIndex);
         nodesToCheck.splice(0, 1);

         areaNodes.delete(nodeIndex);

         // @Speed: If outside, immediately break and do the above on the remaining nodes

         // Top
         if (nodeY < SettingsConst.VULNERABILITY_NODES_IN_WORLD_WIDTH - 1) {
            const nodeIndex = getNodeIndex(nodeX, nodeY + 1);
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
         if (nodeX < SettingsConst.VULNERABILITY_NODES_IN_WORLD_WIDTH - 1) {
            const nodeIndex = getNodeIndex(nodeX + 1, nodeY);
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
            const nodeIndex = getNodeIndex(nodeX, nodeY - 1);
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
            const nodeIndex = getNodeIndex(nodeX - 1, nodeY);
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
   const borderNodes = new Set<VulnerabilityNodeIndex>();
   for (const nodeIndex of occupiedNodeIndexes) {
      const nodeX = nodeIndex % SettingsConst.VULNERABILITY_NODES_IN_WORLD_WIDTH;
      const nodeY = Math.floor(nodeIndex / SettingsConst.VULNERABILITY_NODES_IN_WORLD_WIDTH);

      // Top
      if (nodeY < SettingsConst.VULNERABILITY_NODES_IN_WORLD_WIDTH - 1) {
         const nodeIndex = getNodeIndex(nodeX, nodeY + 1);
         if (!occupiedNodeIndexes.has(nodeIndex) && !insideNodeIndexes.has(nodeIndex)) {
            borderNodes.add(nodeIndex);
         }
      }

      // Right
      if (nodeX < SettingsConst.VULNERABILITY_NODES_IN_WORLD_WIDTH - 1) {
         const nodeIndex = getNodeIndex(nodeX + 1, nodeY);
         if (!occupiedNodeIndexes.has(nodeIndex) && !insideNodeIndexes.has(nodeIndex)) {
            borderNodes.add(nodeIndex);
         }
      }

      // Bottom
      if (nodeY > 0) {
         const nodeIndex = getNodeIndex(nodeX, nodeY - 1);
         if (!occupiedNodeIndexes.has(nodeIndex) && !insideNodeIndexes.has(nodeIndex)) {
            borderNodes.add(nodeIndex);
         }
      }

      // Left
      if (nodeX > 0) {
         const nodeIndex = getNodeIndex(nodeX - 1, nodeY);
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

      const addedNodes = new Set<VulnerabilityNodeIndex>();
      
      for (const nodeIndex of previousOuterNodes) {
         const nodeX = nodeIndex % SettingsConst.VULNERABILITY_NODES_IN_WORLD_WIDTH;
         const nodeY = Math.floor(nodeIndex / SettingsConst.VULNERABILITY_NODES_IN_WORLD_WIDTH);

         // Top
         if (nodeY < SettingsConst.VULNERABILITY_NODES_IN_WORLD_WIDTH - 1) {
            const nodeIndex = getNodeIndex(nodeX, nodeY + 1);
            if (!occupiedNodeIndexes.has(nodeIndex) && !paddingNodeIndexes.has(nodeIndex)) {
               paddingNodeIndexes.add(nodeIndex);
               addedNodes.add(nodeIndex);
            }
         }
   
         // Right
         if (nodeX < SettingsConst.VULNERABILITY_NODES_IN_WORLD_WIDTH - 1) {
            const nodeIndex = getNodeIndex(nodeX + 1, nodeY);
            if (!occupiedNodeIndexes.has(nodeIndex) && !paddingNodeIndexes.has(nodeIndex)) {
               paddingNodeIndexes.add(nodeIndex);
               addedNodes.add(nodeIndex);
            }
         }
   
         // Bottom
         if (nodeY > 0) {
            const nodeIndex = getNodeIndex(nodeX, nodeY - 1);
            if (!occupiedNodeIndexes.has(nodeIndex) && !paddingNodeIndexes.has(nodeIndex)) {
               paddingNodeIndexes.add(nodeIndex);
               addedNodes.add(nodeIndex);
            }
         }
   
         // Left
         if (nodeX > 0) {
            const nodeIndex = getNodeIndex(nodeX - 1, nodeY);
            if (!occupiedNodeIndexes.has(nodeIndex) && !paddingNodeIndexes.has(nodeIndex)) {
               paddingNodeIndexes.add(nodeIndex);
               addedNodes.add(nodeIndex);
            }
         }
      }

      previousOuterNodes = addedNodes;
   }
   
   const nodes = new Array<VulnerabilityNode>();
   const nodeRecord: Record<number, VulnerabilityNode> = {};

   // Add the padding nodes
   for (const nodeIndex of paddingNodeIndexes) {
      const nodeX = nodeIndex % SettingsConst.VULNERABILITY_NODES_IN_WORLD_WIDTH;
      const nodeY = Math.floor(nodeIndex / SettingsConst.VULNERABILITY_NODES_IN_WORLD_WIDTH);

      const node: VulnerabilityNode = {
         x: nodeX,
         y: nodeY,
         vulnerability: Vars.MAX_VULNERABILITY
      };
      nodes.push(node);
      nodeRecord[nodeIndex] = node;
   }

   const remainingNodes = new Array<VulnerabilityNodeIndex>;
   for (const nodeIndex of occupiedNodeIndexes) {
      remainingNodes.push(nodeIndex);
   }
   for (const nodeIndex of insideNodeIndexes) {
      remainingNodes.push(nodeIndex);
   }
   
   // Calculate contained nodes vulnerability
   let i = 0;
   const surroundingNodes = new Array<VulnerabilityNodeIndex>();
   for (const nodeIndex of borderNodes) {
      surroundingNodes.push(nodeIndex);
   }
   while (remainingNodes.length > 0) {
      if (++i >= 10000) {
         console.log("bad");
         console.log(surroundingNodes.length);
         console.log(remainingNodes.length);
         throw new Error();
      }

      // @Incomplete: Don't assume all occupied nodes are safe
      
      // @Speed
      // find the surrounding node with the highest vulnerability
      let maxVulnerability = 0;
      let currentNodeIdx = 0;
      for (let i = 0; i < surroundingNodes.length; i++) {
         const node = surroundingNodes[i];
         const vulnerability = nodeRecord[node].vulnerability;
         if (vulnerability > maxVulnerability) {
            maxVulnerability = vulnerability;
            currentNodeIdx = i;
         }
      }

      const currentNode = surroundingNodes[currentNodeIdx];
      surroundingNodes.splice(currentNodeIdx, 1);

      const nodeX = currentNode % SettingsConst.VULNERABILITY_NODES_IN_WORLD_WIDTH;
      const nodeY = Math.floor(currentNode / SettingsConst.VULNERABILITY_NODES_IN_WORLD_WIDTH);

      // Top
      if (nodeY < SettingsConst.VULNERABILITY_NODES_IN_WORLD_WIDTH - 1) {
         const nodeIndex = getNodeIndex(nodeX, nodeY + 1);
         const idx = remainingNodes.indexOf(nodeIndex);
         if (idx !== -1) {
            const node: VulnerabilityNode = {
               x: nodeX,
               y: nodeY + 1,
               vulnerability: calculateNodeVulnerability(maxVulnerability, occupiedNodeIndexes.has(nodeIndex))
            };
            nodes.push(node);
            nodeRecord[nodeIndex] = node;
            surroundingNodes.push(nodeIndex);
            remainingNodes.splice(idx, 1);
         }
      }

      // Right
      if (nodeX < SettingsConst.VULNERABILITY_NODES_IN_WORLD_WIDTH - 1) {
         const nodeIndex = getNodeIndex(nodeX + 1, nodeY);
         const idx = remainingNodes.indexOf(nodeIndex);
         if (idx !== -1) {
            const node: VulnerabilityNode = {
               x: nodeX + 1,
               y: nodeY,
               vulnerability: calculateNodeVulnerability(maxVulnerability, occupiedNodeIndexes.has(nodeIndex))
            };
            nodes.push(node);
            nodeRecord[nodeIndex] = node;
            surroundingNodes.push(nodeIndex);
            remainingNodes.splice(idx, 1);
         }
      }

      // Bottom
      if (nodeY > 0) {
         const nodeIndex = getNodeIndex(nodeX, nodeY - 1);
         const idx = remainingNodes.indexOf(nodeIndex);
         if (idx !== -1) {
            const node: VulnerabilityNode = {
               x: nodeX,
               y: nodeY - 1,
               vulnerability: calculateNodeVulnerability(maxVulnerability, occupiedNodeIndexes.has(nodeIndex))
            };
            nodes.push(node);
            nodeRecord[nodeIndex] = node;
            surroundingNodes.push(nodeIndex);
            remainingNodes.splice(idx, 1);
         }
      }

      // Left
      if (nodeX > 0) {
         const nodeIndex = getNodeIndex(nodeX - 1, nodeY);
         const idx = remainingNodes.indexOf(nodeIndex);
         if (idx !== -1) {
            const node: VulnerabilityNode = {
               x: nodeX - 1,
               y: nodeY,
               vulnerability: calculateNodeVulnerability(maxVulnerability, occupiedNodeIndexes.has(nodeIndex))
            };
            nodes.push(node);
            nodeRecord[nodeIndex] = node;
            surroundingNodes.push(nodeIndex);
            remainingNodes.splice(idx, 1);
         }
      }
   }

   weightNodeDistances(nodeRecord, previousOuterNodes);
   
   tribe.vulnerabilityNodes = nodes;
   tribe.vulnerabilityNodeRecord = nodeRecord;
   tribe.occupiedVulnerabilityNodes = occupiedNodeIndexes;
   tribe.containedBuildingIDs = containedBuildingIDs;
   tribe.insideNodes = insideNodeIndexes;
   tribe.occupiedNodeToEntityIDRecord = occupiedNodeToEntityIDRecord;
}

export function tickTribes(): void {
   for (let i = 0; i < Board.tribes.length; i++) {
      const tribe = Board.tribes[i];
      
      // Update vulnerability nodes
      if (tribe.buildingsAreDirty) {
         const occupiedNodesInfo = getOccupiedNodesInfo(tribe);
         updateTribeVulnerabilityNodes(tribe, occupiedNodesInfo.occupiedNodeIndexes, occupiedNodesInfo.occupiedNodeToEntityIDRecord);

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

      updateTribeNextBuilding(tribe);
      
      if (Board.ticks % SettingsConst.TPS === 0) {
         // @Cleanup: Not related to tribe building
         tribe.updateAvailableResources();
      }
   }
}

// @Cleanup: Copy and paste
const addTileNodePositions = (placeCandidate: WallPlaceCandidate, occupiedNodeIndexes: Set<VulnerabilityNodeIndex>): void => {
   const minX = placeCandidate.position.x - SettingsConst.TILE_SIZE * 0.5;
   const maxX = placeCandidate.position.x + SettingsConst.TILE_SIZE * 0.5;
   const minY = placeCandidate.position.y - SettingsConst.TILE_SIZE * 0.5;
   const maxY = placeCandidate.position.y + SettingsConst.TILE_SIZE * 0.5;

   const rectPosX = placeCandidate.position.x;
   const rectPosY = placeCandidate.position.y;
   
   // @Speed: Math.round might also work
   const minNodeX = Math.max(Math.floor(minX / SettingsConst.VULNERABILITY_NODE_SEPARATION), 0);
   const maxNodeX = Math.min(Math.ceil(maxX / SettingsConst.VULNERABILITY_NODE_SEPARATION), SettingsConst.VULNERABILITY_NODES_IN_WORLD_WIDTH - 1);
   const minNodeY = Math.max(Math.floor(minY / SettingsConst.VULNERABILITY_NODE_SEPARATION), 0);
   const maxNodeY = Math.min(Math.ceil(maxY / SettingsConst.VULNERABILITY_NODE_SEPARATION), SettingsConst.VULNERABILITY_NODES_IN_WORLD_WIDTH - 1);

   for (let nodeX = minNodeX; nodeX <= maxNodeX; nodeX++) {
      for (let nodeY = minNodeY; nodeY <= maxNodeY; nodeY++) {
         const x = nodeX * SettingsConst.VULNERABILITY_NODE_SEPARATION;
         const y = nodeY * SettingsConst.VULNERABILITY_NODE_SEPARATION;
         if (pointIsInRectangle(x, y, rectPosX, rectPosY, SettingsConst.TILE_SIZE, SettingsConst.TILE_SIZE, placeCandidate.rotation)) {
            const nodeIndex = getNodeIndex(nodeX, nodeY);
            occupiedNodeIndexes.add(nodeIndex);
         }
      }
   }
}

const getBuildingMinVulnerability = (tribe: Tribe, building: Entity): number => {
   const occupiedIndexes = new Set<VulnerabilityNodeIndex>();
   addEntityNodePositions(building, occupiedIndexes, {});

   let maxVulnerability = 0;
   for (const nodeIndex of occupiedIndexes) {
      const vulnerability = tribe.vulnerabilityNodeRecord[nodeIndex].vulnerability;
      if (vulnerability > maxVulnerability) {
         maxVulnerability = vulnerability;
      }
   }

   return maxVulnerability;
}

const getBuildingAverageVulnerability = (tribe: Tribe, building: Entity): number => {
   const occupiedIndexes = new Set<VulnerabilityNodeIndex>();
   addEntityNodePositions(building, occupiedIndexes, {});

   let averageVulnerability = 0;
   for (const nodeIndex of occupiedIndexes) {
      const vulnerability = tribe.vulnerabilityNodeRecord[nodeIndex].vulnerability;
      averageVulnerability += vulnerability;
   }

   if (averageVulnerability < 0) {
      averageVulnerability = 0;
   }

   // @Speed: Don't need to do the division as we are just comparing the averages and the occupied size will always be the same
   return averageVulnerability / occupiedIndexes.size;
}

const buildingIsInfrastructure = (entityType: IEntityType): boolean => {
   return entityType !== IEntityType.wall && entityType !== IEntityType.embrasure && entityType !== IEntityType.door && entityType !== IEntityType.tunnel;
}

const getVulnerableBuilding = (tribe: Tribe): Entity | null => {
   let maxVulnerability = Vars.MAX_SAFE_VULNERABILITY;
   let vulnerableBuilding: Entity;
   for (let i = 0; i < tribe.buildings.length; i++) {
      const building = tribe.buildings[i];
      if (!buildingIsInfrastructure(building.type)) {
         continue;
      }

      const vulnerability = getBuildingMinVulnerability(tribe, building);
      if (vulnerability > maxVulnerability) {
         maxVulnerability = vulnerability;
         vulnerableBuilding = building;
      }
   }

   if (maxVulnerability > Vars.MAX_SAFE_VULNERABILITY) {
      return vulnerableBuilding!;
   }
   return null;
}

const entityCollidesWithWall = (x: number, y: number, wallRotation: number, entity: Entity): boolean => {
   for (let i = 0; i < entity.hitboxes.length; i++) {
      const hitbox = entity.hitboxes[i];
      // @Cleanup: copy and paste
      if (hitbox.hasOwnProperty("radius")) {
         if (circleAndRectangleDoIntersect(hitbox.x, hitbox.y, (hitbox as CircularHitbox).radius, x, y, SettingsConst.TILE_SIZE, SettingsConst.TILE_SIZE, wallRotation)) {
            return true;
         }
      } else {
         // @Incomplete @Hack: This should be * 0.5, but doing that causes the wall to think its colliding with its snap-pairing wall
         const x1 = -SettingsConst.TILE_SIZE * 0.4;
         const x2 = SettingsConst.TILE_SIZE * 0.4;
         const y2 = SettingsConst.TILE_SIZE * 0.4;

         const sinRotation = Math.sin(wallRotation);
         const cosRotation = Math.cos(wallRotation);
         
         const topLeftX = cosRotation * x1 + sinRotation * y2;
         const topLeftY = cosRotation * y2 - sinRotation * x1;
         const topRightX = cosRotation * x2 + sinRotation * y2;
         const topRightY = cosRotation * y2 - sinRotation * x2;

         // @Speed
         const tileVertexOffsets: HitboxVertexPositions = [
            new Point(topLeftX, topLeftY),
            new Point(topRightX, topRightY),
            new Point(-topLeftX, -topLeftY),
            new Point(-topRightX, -topRightY)
         ];
         if (rectanglePointsDoIntersect(tileVertexOffsets, (hitbox as RectangularHitbox).vertexOffsets, x, y, hitbox.x, hitbox.y, cosRotation, -sinRotation, (hitbox as RectangularHitbox).axisX, (hitbox as RectangularHitbox).axisY)) {
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

   for (let chunkX = minChunkX; chunkX <= maxChunkX; chunkX++) {
      for (let chunkY = minChunkY; chunkY <= maxChunkY; chunkY++) {
         const chunk = Board.getChunk(chunkX, chunkY);

         for (let i = 0; i < chunk.entities.length; i++) {
            const entity = chunk.entities[i];
            if (tribe.buildings.indexOf(entity) === -1) {
               continue;
            }
      
            if (entityCollidesWithWall(x, y, wallRotation, entity)) {
               return false;
            }
         }
      }
   }

   return true;
}

interface WallPlaceCandidate {
   readonly position: Point;
   readonly rotation: number;
   readonly isSnappedToWall: boolean;
}

const getWallPlaceCandidates = (tribe: Tribe, building: Entity): ReadonlyArray<WallPlaceCandidate> => {
   const occupiedIndexes = new Set<VulnerabilityNodeIndex>();
   addEntityNodePositions(building, occupiedIndexes, {});

   const occupyingTileIndexes = new Array<number>();
   for (const nodeIndex of occupiedIndexes) {
      const nodeX = nodeIndex % SettingsConst.VULNERABILITY_NODES_IN_WORLD_WIDTH;
      const nodeY = Math.floor(nodeIndex / SettingsConst.VULNERABILITY_NODES_IN_WORLD_WIDTH);

      const tileX = Math.floor(nodeX * SettingsConst.VULNERABILITY_NODE_SEPARATION / SettingsConst.TILE_SIZE);
      const tileY = Math.floor(nodeY * SettingsConst.VULNERABILITY_NODE_SEPARATION / SettingsConst.TILE_SIZE);

      const tileIndex = tileY * SettingsConst.TILES_IN_WORLD_WIDTH + tileX;
      if (occupyingTileIndexes.indexOf(tileIndex) === -1) {
         occupyingTileIndexes.push(tileIndex);
      }
   }

   // Find all neighbouring tile indexes
   const neighbouringTileIndexes = new Array<number>();
   for (let i = 0; i < occupyingTileIndexes.length; i++) {
      const tileIndex = occupyingTileIndexes[i];

      const tileX = tileIndex % SettingsConst.TILES_IN_WORLD_WIDTH;
      const tileY = Math.floor(tileIndex / SettingsConst.TILES_IN_WORLD_WIDTH);

      // Bottom
      if (tileY > 0) {
         const tileIndex = (tileY - 1) * SettingsConst.TILES_IN_WORLD_WIDTH + tileX;
         if (occupyingTileIndexes.indexOf(tileIndex) === -1 && neighbouringTileIndexes.indexOf(tileIndex) === -1) {
            neighbouringTileIndexes.push(tileIndex);
         }
      }

      // Left
      if (tileX > 0) {
         const tileIndex = tileY * SettingsConst.TILES_IN_WORLD_WIDTH + tileX - 1;
         if (occupyingTileIndexes.indexOf(tileIndex) === -1 && neighbouringTileIndexes.indexOf(tileIndex) === -1) {
            neighbouringTileIndexes.push(tileIndex);
         }
      }

      // Top
      if (tileY < SettingsConst.TILES_IN_WORLD_WIDTH - 1) {
         const tileIndex = (tileY + 1) * SettingsConst.TILES_IN_WORLD_WIDTH + tileX;
         if (occupyingTileIndexes.indexOf(tileIndex) === -1 && neighbouringTileIndexes.indexOf(tileIndex) === -1) {
            neighbouringTileIndexes.push(tileIndex);
         }
      }

      // Right
      if (tileX < SettingsConst.TILES_IN_WORLD_WIDTH - 1) {
         const tileIndex = tileY * SettingsConst.TILES_IN_WORLD_WIDTH + tileX + 1;
         if (occupyingTileIndexes.indexOf(tileIndex) === -1 && neighbouringTileIndexes.indexOf(tileIndex) === -1) {
            neighbouringTileIndexes.push(tileIndex);
         }
      }
   }
   
   const placeCandidates = new Array<WallPlaceCandidate>();

   // Add non-occupied tiles
   for (let i = 0; i < neighbouringTileIndexes.length; i++) {
      const tileIndex = neighbouringTileIndexes[i];
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
   
   // @Incomplete: Add tile positions which would connect to existing walls
   const minX = building.boundingAreaMinX - Vars.WALL_SNAP_SEARCH_DISTANCE - 64;
   const maxX = building.boundingAreaMaxX + Vars.WALL_SNAP_SEARCH_DISTANCE + 64;
   const minY = building.boundingAreaMinY - Vars.WALL_SNAP_SEARCH_DISTANCE - 64;
   const maxY = building.boundingAreaMaxY + Vars.WALL_SNAP_SEARCH_DISTANCE + 64;

   const minChunkX = Math.max(Math.floor(minX / SettingsConst.CHUNK_UNITS), 0);
   const maxChunkX = Math.min(Math.floor(maxX / SettingsConst.CHUNK_UNITS), SettingsConst.BOARD_SIZE - 1);
   const minChunkY = Math.max(Math.floor(minY / SettingsConst.CHUNK_UNITS), 0);
   const maxChunkY = Math.min(Math.floor(maxY / SettingsConst.CHUNK_UNITS), SettingsConst.BOARD_SIZE - 1);

   const seenEntityIDs = new Array<number>();
   for (let chunkX = minChunkX; chunkX <= maxChunkX; chunkX++) {
      for (let chunkY = minChunkY; chunkY <= maxChunkY; chunkY++) {
         const chunk = Board.getChunk(chunkX, chunkY);

         for (let i = 0; i < chunk.entities.length; i++) {
            const entity = chunk.entities[i];
            if (entity.type !== IEntityType.wall || seenEntityIDs.indexOf(entity.id) !== -1) {
               continue;
            }
            seenEntityIDs.push(entity.id);
            
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
   
   return placeCandidates;
}

const findIdealWallPlacePosition = (tribe: Tribe, building: Entity): BuildingPlan | null => {
   const potentialWallPlaceCandidates = getWallPlaceCandidates(tribe, building);
   if (potentialWallPlaceCandidates.length === 0) {
      // Unable to find a position
      return null;
   }

   const realNodes = tribe.vulnerabilityNodes;
   const realNodeRecord = tribe.vulnerabilityNodeRecord;
   const realOccupiedNodes = tribe.occupiedVulnerabilityNodes;
   const realInsideNodes = tribe.insideNodes;
   const realContainedBuildingIDs = tribe.containedBuildingIDs;
   
   // @Incomplete: run average check only using the tied candidates
   
   // Simulate placing each position to see which one reduces vulnerability the most
   let bestMinVulnerability = Vars.MAX_VULNERABILITY + 1;
   let bestMinCandidate: WallPlaceCandidate;
   let bestAverageVulnerability = Vars.MAX_VULNERABILITY + 1;
   let bestAverageCandidate: WallPlaceCandidate;
   let currentBestIsDuplicate = false;
   for (let i = 0; i < potentialWallPlaceCandidates.length; i++) {
      const placeCandidate = potentialWallPlaceCandidates[i];

      const occupiedNodesInfo = getOccupiedNodesInfo(tribe);
      addTileNodePositions(placeCandidate, occupiedNodesInfo.occupiedNodeIndexes);

      updateTribeVulnerabilityNodes(tribe, occupiedNodesInfo.occupiedNodeIndexes, occupiedNodesInfo.occupiedNodeToEntityIDRecord);

      let minVulnerability = getBuildingMinVulnerability(tribe, building);
      let averageVulnerability = getBuildingAverageVulnerability(tribe, building);

      // Make the AI want to snap to existing walls more
      if (placeCandidate.isSnappedToWall) {
         minVulnerability -= 5;
         averageVulnerability -= 5;
      }
      
      if (minVulnerability < bestMinVulnerability) {
         bestMinVulnerability = minVulnerability;
         bestMinCandidate = placeCandidate;
         currentBestIsDuplicate = false
      } else if (minVulnerability === minVulnerability) {
         currentBestIsDuplicate = true;
      }
      if (averageVulnerability < bestAverageVulnerability) {
         bestAverageVulnerability = averageVulnerability;
         bestAverageCandidate = placeCandidate;
      }

      // Reset back to real nodes
      tribe.vulnerabilityNodes = realNodes;
      tribe.vulnerabilityNodeRecord = realNodeRecord;
      tribe.occupiedVulnerabilityNodes = realOccupiedNodes;
      tribe.insideNodes = realInsideNodes;
      tribe.containedBuildingIDs = realContainedBuildingIDs;
   }

   if (bestMinVulnerability > Vars.MAX_VULNERABILITY) {
      throw new Error();
   }

   const candidate = currentBestIsDuplicate ? bestAverageCandidate! : bestMinCandidate!;
   return {
      position: candidate.position,
      rotation: candidate.rotation,
      buildingRecipe: getItemRecipe(ItemType.wooden_wall)!,
      assignedTribesmanID: 0
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

export function updateTribeNextBuilding(tribe: Tribe): void {
   // Priorities:
   // 1) Protect vulnerable buildings

   if (tribe.buildingPlan !== null) {
      // Make sure the plan is still valid
      if (planIsInvalid(tribe, tribe.buildingPlan)) {
         tribe.buildingPlan = null;
      } else {
         return;
      }
   }

   // Check for vulnerable buildings
   const building = getVulnerableBuilding(tribe);
   if (building !== null) {
      // Find the place for a wall that would minimise the building's vulnerability
      const wallPlan = findIdealWallPlacePosition(tribe, building);

      tribe.buildingPlan = wallPlan;
      return;
   }

   tribe.buildingPlan = null;
}

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

      for (let j = 0; j < tribe.vulnerabilityNodes.length; j++) {
         const node = tribe.vulnerabilityNodes[j];

         // @Incomplete: filter out nodes which aren't in the chunk bounds
         
         const nodeIndex = getNodeIndex(node.x, node.y);
         vulnerabilityNodesData.push({
            index: nodeIndex,
            vulnerability: node.vulnerability,
            isOccupied: tribe.occupiedVulnerabilityNodes.has(nodeIndex),
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
            minVulnerability: getBuildingMinVulnerability(tribe, building),
            averageVulnerability: getBuildingAverageVulnerability(tribe, building)
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