import { BuildingPlanData, HitboxVertexPositions, IEntityType, ItemType, Point, SettingsConst, VisibleChunkBounds, VulnerabilityNodeData, circleAndRectangleDoIntersect, pointIsInRectangle, rectanglePointsDoIntersect } from "webgl-test-shared";
import Entity from "./Entity";
import Tribe, { BuildingPlan } from "./Tribe";
import CircularHitbox from "./hitboxes/CircularHitbox";
import RectangularHitbox from "./hitboxes/RectangularHitbox";
import Board from "./Board";
import { TribeComponentArray } from "./components/ComponentArray";

const enum Vars {
   MAX_VULNERABILITY = 100,
   /** Base amount the vulnerability decreases when moving in a node */
   SAFE_DISTANCE_FALLOFF = 2,
   /** Falloff from distance from outside the padding */
   DISTANCE_FALLOFF = 4,
   BORDER_PADDING = 5,
   MAX_SAFE_VULNERABILITY = 50
}

type VulnerabilityNodeIndex = number;

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

const addCircularHitboxNodePositions = (hitbox: CircularHitbox, positions: Set<VulnerabilityNodeIndex>): void => {
   const minX = hitbox.calculateHitboxBoundsMinX();
   const maxX = hitbox.calculateHitboxBoundsMaxX();
   const minY = hitbox.calculateHitboxBoundsMinY();
   const maxY = hitbox.calculateHitboxBoundsMaxY();

   const centerX = (hitbox.object.position.x + hitbox.rotatedOffsetX) / SettingsConst.VULNERABILITY_NODE_SEPARATION;
   const centerY = (hitbox.object.position.y + hitbox.rotatedOffsetY) / SettingsConst.VULNERABILITY_NODE_SEPARATION;
   
   const minNodeX = Math.max(Math.floor(minX / SettingsConst.VULNERABILITY_NODE_SEPARATION), 0);
   const maxNodeX = Math.min(Math.ceil(maxX / SettingsConst.VULNERABILITY_NODE_SEPARATION), SettingsConst.VULNERABILITY_NODES_IN_WORLD_WIDTH - 1);
   const minNodeY = Math.max(Math.floor(minY / SettingsConst.VULNERABILITY_NODE_SEPARATION), 0);
   const maxNodeY = Math.min(Math.ceil(maxY / SettingsConst.VULNERABILITY_NODE_SEPARATION), SettingsConst.VULNERABILITY_NODES_IN_WORLD_WIDTH - 1);

   const hitboxNodeRadius = hitbox.radius / SettingsConst.VULNERABILITY_NODE_SEPARATION;
   const hitboxNodeRadiusSquared = hitboxNodeRadius * hitboxNodeRadius;

   for (let nodeX = minNodeX; nodeX <= maxNodeX; nodeX++) {
      for (let nodeY = minNodeY; nodeY <= maxNodeY; nodeY++) {
         const xDiff = nodeX - centerX;
         const yDiff = nodeY - centerY;
         if (xDiff * xDiff + yDiff * yDiff <= hitboxNodeRadiusSquared) {
            const nodeIndex = getNodeIndex(nodeX, nodeY);
            positions.add(nodeIndex);
         }
      }
   }
}

const addRectangularHitboxNodePositions = (hitbox: RectangularHitbox, positions: Set<VulnerabilityNodeIndex>): void => {
   const minX = hitbox.calculateHitboxBoundsMinX();
   const maxX = hitbox.calculateHitboxBoundsMaxX();
   const minY = hitbox.calculateHitboxBoundsMinY();
   const maxY = hitbox.calculateHitboxBoundsMaxY();

   const rectPosX = (hitbox.object.position.x + hitbox.rotatedOffsetX);
   const rectPosY = (hitbox.object.position.y + hitbox.rotatedOffsetY);
   
   // @Speed: Math.round might also work
   const minNodeX = Math.max(Math.floor(minX / SettingsConst.VULNERABILITY_NODE_SEPARATION), 0);
   const maxNodeX = Math.min(Math.ceil(maxX / SettingsConst.VULNERABILITY_NODE_SEPARATION), SettingsConst.VULNERABILITY_NODES_IN_WORLD_WIDTH - 1);
   const minNodeY = Math.max(Math.floor(minY / SettingsConst.VULNERABILITY_NODE_SEPARATION), 0);
   const maxNodeY = Math.min(Math.ceil(maxY / SettingsConst.VULNERABILITY_NODE_SEPARATION), SettingsConst.VULNERABILITY_NODES_IN_WORLD_WIDTH - 1);

   for (let nodeX = minNodeX; nodeX <= maxNodeX; nodeX++) {
      for (let nodeY = minNodeY; nodeY <= maxNodeY; nodeY++) {
         const x = nodeX * SettingsConst.VULNERABILITY_NODE_SEPARATION;
         const y = nodeY * SettingsConst.VULNERABILITY_NODE_SEPARATION;
         if (pointIsInRectangle(x, y, rectPosX, rectPosY, hitbox.width, hitbox.height, hitbox.rotation + hitbox.object.rotation)) {
            const nodeIndex = getNodeIndex(nodeX, nodeY);
            positions.add(nodeIndex);
         }
      }
   }
}

export function addEntityNodePositions(entity: Entity, positions: Set<VulnerabilityNodeIndex>): void {
   for (let i = 0; i < entity.hitboxes.length; i++) {
      const hitbox = entity.hitboxes[i];

      // Add to occupied pathfinding nodes
      if (hitbox.hasOwnProperty("radius")) {
         addCircularHitboxNodePositions(hitbox as CircularHitbox, positions);
      } else {
         addRectangularHitboxNodePositions(hitbox as RectangularHitbox, positions);
      }
   }
}

const getVulnerabilityNodePositions = (tribe: Tribe): Set<VulnerabilityNodeIndex> => {
   const positions = new Set<VulnerabilityNodeIndex>();

   // Add nodes from buildings
   for (let i = 0; i < tribe.buildings.length; i++) {
      const building = tribe.buildings[i];
      addEntityNodePositions(building, positions);
   }
   
   return positions;
}

/** Gets all nodes within the tribe's bounding area which aren't occupied */
const getAreaNodes = (occupiedNodeIndexes: Set<VulnerabilityNodeIndex>, minNodeX: number, maxNodeX: number, minNodeY: number, maxNodeY: number): Array<VulnerabilityNodeIndex> => {
   const area = new Array<VulnerabilityNodeIndex>();
   for (let nodeX = minNodeX; nodeX <= maxNodeX; nodeX++) {
      for (let nodeY = minNodeY; nodeY <= maxNodeY; nodeY++) {
         const nodeIndex = getNodeIndex(nodeX, nodeY);
         if (occupiedNodeIndexes.has(nodeIndex)) {
            area.push(nodeIndex);
         }
      }
   }
   return area;
}

const calculateNodeVulnerability = (nodeIndex: number, maxAdjacentVulnerability: number, occupiedNodeIndexes: Set<VulnerabilityNodeIndex>, insideNodeIndexes: Set<VulnerabilityNodeIndex>, paddingNodeIndexes: Set<VulnerabilityNodeIndex>): number => {
   const originNodeX = nodeIndex % SettingsConst.VULNERABILITY_NODES_IN_WORLD_WIDTH;
   const originNodeY = Math.floor(nodeIndex / SettingsConst.VULNERABILITY_NODES_IN_WORLD_WIDTH);
   
   // @Speed
   // Find distance from a not-present node
   let dist = 1;
   outer:
   for (; dist < 50; dist++) {
      const minNodeX = Math.max(originNodeX - dist, 0);
      const maxNodeX = Math.min(originNodeX + dist, SettingsConst.VULNERABILITY_NODES_IN_WORLD_WIDTH - 1);
      const minNodeY = Math.max(originNodeY - dist, 0);
      const maxNodeY = Math.min(originNodeY + dist, SettingsConst.VULNERABILITY_NODES_IN_WORLD_WIDTH - 1);

      for (let nodeX = minNodeX; nodeX <= maxNodeX; nodeX++) {
         for (let nodeY = minNodeY; nodeY <= maxNodeY; nodeY++) {
            const diffX = nodeX - originNodeX;
            const diffY = nodeY - originNodeY;
            if (diffX * diffX + diffY * diffY >= dist * dist) {
               continue;
            }
            
            const currentNodeIndex = getNodeIndex(nodeX, nodeY);

            if (!occupiedNodeIndexes.has(currentNodeIndex) && !insideNodeIndexes.has(currentNodeIndex) && !paddingNodeIndexes.has(currentNodeIndex)) {
               break outer;
            }
         }
      }
   }
   
   // @Incomplete:
   // - when first populating the nodes, don't use DISTANCE_FALLOFF.
   //   dist should be added after all the nodes are populated.
   // - padding nodes shouldn't subtract SAFE_DISTANCE_FALLOFF.
   
   let vulnerability = maxAdjacentVulnerability - Vars.SAFE_DISTANCE_FALLOFF - dist * Vars.DISTANCE_FALLOFF;
   if (vulnerability < 0) {
      vulnerability = 0;
   }
   return vulnerability;
}

const updateTribeVulnerabilityNodes = (tribe: Tribe, occupiedNodeIndexes: Set<VulnerabilityNodeIndex>): void => {
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

   // Find inside nodes
   const insideNodeIndexes = new Set<VulnerabilityNodeIndex>();
   while (areaNodes.length > 0) {
      const nodeIdx = Math.floor(Math.random() * areaNodes.length);
      const originNodeIndex = areaNodes[nodeIdx];

      let isInside = true;

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

         areaNodes.splice(areaNodes.indexOf(nodeIndex), 1);

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
         }
      }

      if (isInside) {
         for (let i = 0; i < connectedNodes.length; i++) {
            const nodeIndex = connectedNodes[i];
            insideNodeIndexes.add(nodeIndex);
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
   
   let i = 0;
   // Calculate occupied + inside nodes vulnerability
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
               vulnerability: calculateNodeVulnerability(nodeIndex, maxVulnerability, occupiedNodeIndexes, insideNodeIndexes, paddingNodeIndexes)
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
               vulnerability: calculateNodeVulnerability(nodeIndex, maxVulnerability, occupiedNodeIndexes, insideNodeIndexes, paddingNodeIndexes)
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
               vulnerability: calculateNodeVulnerability(nodeIndex, maxVulnerability, occupiedNodeIndexes, insideNodeIndexes, paddingNodeIndexes)
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
               vulnerability: calculateNodeVulnerability(nodeIndex, maxVulnerability, occupiedNodeIndexes, insideNodeIndexes, paddingNodeIndexes)
            };
            nodes.push(node);
            nodeRecord[nodeIndex] = node;
            surroundingNodes.push(nodeIndex);
            remainingNodes.splice(idx, 1);
         }
      }
   }
   
   tribe.vulnerabilityNodes = nodes;
   tribe.vulnerabilityNodeRecord = nodeRecord;
}

export function tickTribes(): void {
   for (let i = 0; i < Board.tribes.length; i++) {
      const tribe = Board.tribes[i];
      
      // Update vulnerability nodes
      if (tribe.buildingsAreDirty) {
         const occupiedNodeIndexes = getVulnerabilityNodePositions(tribe);
         updateTribeVulnerabilityNodes(tribe, occupiedNodeIndexes);

         tribe.buildingsAreDirty = false;
      }

      if (Board.ticks % SettingsConst.TPS === 0) {
         updateTribeNextBuilding(tribe);
      }
   }
}

export function getVisibleVulnerabilityNodesData(chunkBounds: VisibleChunkBounds): ReadonlyArray<VulnerabilityNodeData> {
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

   const vulnerabilityNodesData = new Array<VulnerabilityNodeData>();
   for (let i = 0; i < visibleTribes.length; i++) {
      const tribe = visibleTribes[i];

      for (let j = 0; j < tribe.vulnerabilityNodes.length; j++) {
         const node = tribe.vulnerabilityNodes[j];
         
         const nodeIndex = getNodeIndex(node.x, node.y);
         vulnerabilityNodesData.push({
            index: nodeIndex,
            vulnerability: node.vulnerability
         });
      }
   }

   return vulnerabilityNodesData;
}

// @Cleanup: Copy and paste
const getCircularHitboxNodePositions = (hitbox: CircularHitbox, indexes: Array<VulnerabilityNodeIndex>): void => {
   const minX = hitbox.calculateHitboxBoundsMinX();
   const maxX = hitbox.calculateHitboxBoundsMaxX();
   const minY = hitbox.calculateHitboxBoundsMinY();
   const maxY = hitbox.calculateHitboxBoundsMaxY();

   const centerX = (hitbox.object.position.x + hitbox.rotatedOffsetX) / SettingsConst.VULNERABILITY_NODE_SEPARATION;
   const centerY = (hitbox.object.position.y + hitbox.rotatedOffsetY) / SettingsConst.VULNERABILITY_NODE_SEPARATION;
   
   const minNodeX = Math.max(Math.floor(minX / SettingsConst.VULNERABILITY_NODE_SEPARATION), 0);
   const maxNodeX = Math.min(Math.ceil(maxX / SettingsConst.VULNERABILITY_NODE_SEPARATION), SettingsConst.VULNERABILITY_NODES_IN_WORLD_WIDTH - 1);
   const minNodeY = Math.max(Math.floor(minY / SettingsConst.VULNERABILITY_NODE_SEPARATION), 0);
   const maxNodeY = Math.min(Math.ceil(maxY / SettingsConst.VULNERABILITY_NODE_SEPARATION), SettingsConst.VULNERABILITY_NODES_IN_WORLD_WIDTH - 1);

   const hitboxNodeRadius = hitbox.radius / SettingsConst.VULNERABILITY_NODE_SEPARATION;
   const hitboxNodeRadiusSquared = hitboxNodeRadius * hitboxNodeRadius;

   for (let nodeX = minNodeX; nodeX <= maxNodeX; nodeX++) {
      for (let nodeY = minNodeY; nodeY <= maxNodeY; nodeY++) {
         const xDiff = nodeX - centerX;
         const yDiff = nodeY - centerY;
         if (xDiff * xDiff + yDiff * yDiff <= hitboxNodeRadiusSquared) {
            const nodeIndex = getNodeIndex(nodeX, nodeY);
            if (indexes.indexOf(nodeIndex) === -1) {
               indexes.push(nodeIndex);
            }
         }
      }
   }
}

// @Cleanup: Copy and paste
const getRectangularHitboxNodePositions = (hitbox: RectangularHitbox, indexes: Array<VulnerabilityNodeIndex>): void => {
   const minX = hitbox.calculateHitboxBoundsMinX();
   const maxX = hitbox.calculateHitboxBoundsMaxX();
   const minY = hitbox.calculateHitboxBoundsMinY();
   const maxY = hitbox.calculateHitboxBoundsMaxY();

   const rectPosX = (hitbox.object.position.x + hitbox.rotatedOffsetX);
   const rectPosY = (hitbox.object.position.y + hitbox.rotatedOffsetY);
   
   // @Speed: Math.round might also work
   const minNodeX = Math.max(Math.floor(minX / SettingsConst.VULNERABILITY_NODE_SEPARATION), 0);
   const maxNodeX = Math.min(Math.ceil(maxX / SettingsConst.VULNERABILITY_NODE_SEPARATION), SettingsConst.VULNERABILITY_NODES_IN_WORLD_WIDTH - 1);
   const minNodeY = Math.max(Math.floor(minY / SettingsConst.VULNERABILITY_NODE_SEPARATION), 0);
   const maxNodeY = Math.min(Math.ceil(maxY / SettingsConst.VULNERABILITY_NODE_SEPARATION), SettingsConst.VULNERABILITY_NODES_IN_WORLD_WIDTH - 1);

   for (let nodeX = minNodeX; nodeX <= maxNodeX; nodeX++) {
      for (let nodeY = minNodeY; nodeY <= maxNodeY; nodeY++) {
         const x = nodeX * SettingsConst.VULNERABILITY_NODE_SEPARATION;
         const y = nodeY * SettingsConst.VULNERABILITY_NODE_SEPARATION;
         if (pointIsInRectangle(x, y, rectPosX, rectPosY, hitbox.width, hitbox.height, hitbox.rotation + hitbox.object.rotation)) {
            const nodeIndex = getNodeIndex(nodeX, nodeY);
            if (indexes.indexOf(nodeIndex) === -1) {
               indexes.push(nodeIndex);
            }
         }
      }
   }
}

// @Cleanup: Copy and paste
export function getEntityNodePositions(entity: Entity): ReadonlyArray<VulnerabilityNodeIndex> {
   const indexes = new Array<VulnerabilityNodeIndex>();
   for (let i = 0; i < entity.hitboxes.length; i++) {
      const hitbox = entity.hitboxes[i];

      // Add to occupied pathfinding nodes
      if (hitbox.hasOwnProperty("radius")) {
         getCircularHitboxNodePositions(hitbox as CircularHitbox, indexes);
      } else {
         getRectangularHitboxNodePositions(hitbox as RectangularHitbox, indexes);
      }
   }
   return indexes;
}

// @Cleanup: Copy and paste
const addTileNodePositions = (tileIndex: number, occupiedNodeIndexes: Set<VulnerabilityNodeIndex>): void => {
   const tileX = tileIndex % SettingsConst.TILES_IN_WORLD_WIDTH;
   const tileY = Math.floor(tileIndex / SettingsConst.TILES_IN_WORLD_WIDTH);

   const minX = tileX * SettingsConst.TILE_SIZE;
   const maxX = (tileX + 1) * SettingsConst.TILE_SIZE;
   const minY = tileY * SettingsConst.TILE_SIZE;
   const maxY = (tileY + 1) * SettingsConst.TILE_SIZE;

   const rectPosX = (tileX + 0.5) * SettingsConst.TILE_SIZE;
   const rectPosY = (tileY + 0.5) * SettingsConst.TILE_SIZE;
   
   // @Speed: Math.round might also work
   const minNodeX = Math.max(Math.floor(minX / SettingsConst.VULNERABILITY_NODE_SEPARATION), 0);
   const maxNodeX = Math.min(Math.ceil(maxX / SettingsConst.VULNERABILITY_NODE_SEPARATION), SettingsConst.VULNERABILITY_NODES_IN_WORLD_WIDTH - 1);
   const minNodeY = Math.max(Math.floor(minY / SettingsConst.VULNERABILITY_NODE_SEPARATION), 0);
   const maxNodeY = Math.min(Math.ceil(maxY / SettingsConst.VULNERABILITY_NODE_SEPARATION), SettingsConst.VULNERABILITY_NODES_IN_WORLD_WIDTH - 1);

   for (let nodeX = minNodeX; nodeX <= maxNodeX; nodeX++) {
      for (let nodeY = minNodeY; nodeY <= maxNodeY; nodeY++) {
         const x = nodeX * SettingsConst.VULNERABILITY_NODE_SEPARATION;
         const y = nodeY * SettingsConst.VULNERABILITY_NODE_SEPARATION;
         if (pointIsInRectangle(x, y, rectPosX, rectPosY, SettingsConst.TILE_SIZE, SettingsConst.TILE_SIZE, 0)) {
            const nodeIndex = getNodeIndex(nodeX, nodeY);
            occupiedNodeIndexes.add(nodeIndex);
         }
      }
   }
}

const getBuildingVulnerability = (tribe: Tribe, building: Entity): number => {
   const occupiedIndexes = getEntityNodePositions(building);

   let maxVulnerability = 0;
   for (let i = 0; i < occupiedIndexes.length; i++) {
      const nodeIndex = occupiedIndexes[i];

      const vulnerability = tribe.vulnerabilityNodeRecord[nodeIndex].vulnerability;
      if (vulnerability > maxVulnerability) {
         maxVulnerability = vulnerability;
      }
   }

   return maxVulnerability;
}

const getVulnerableBuilding = (tribe: Tribe): Entity | null => {
   let maxVulnerability = Vars.MAX_SAFE_VULNERABILITY;
   let vulnerableBuilding: Entity;
   for (let i = 0; i < tribe.buildings.length; i++) {
      const building = tribe.buildings[i];
      if (building.type === IEntityType.wall || building.type === IEntityType.embrasure || building.type === IEntityType.door || building.type === IEntityType.tunnel) {
         continue;
      }

      const vulnerability = getBuildingVulnerability(tribe, building);
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

const entityCollidesWithTile = (tileX: number, tileY: number, entity: Entity): boolean => {
   const x = (tileX + 0.5) * SettingsConst.TILE_SIZE;
   const y = (tileY + 0.5) * SettingsConst.TILE_SIZE;
   
   for (let i = 0; i < entity.hitboxes.length; i++) {
      const hitbox = entity.hitboxes[i];
      // @Cleanup: copy and paste
      if (hitbox.hasOwnProperty("radius")) {
         if (circleAndRectangleDoIntersect(hitbox.object.position.x + hitbox.rotatedOffsetX, hitbox.object.position.y + hitbox.rotatedOffsetY, (hitbox as CircularHitbox).radius, x, y, SettingsConst.TILE_SIZE, SettingsConst.TILE_SIZE, 0)) {
            return true;
         }
      } else {
         // @Speed
         const tileVertexOffsets: HitboxVertexPositions = [
            new Point(-SettingsConst.TILE_SIZE/2, SettingsConst.TILE_SIZE/2),
            new Point(SettingsConst.TILE_SIZE/2, SettingsConst.TILE_SIZE/2),
            new Point(-SettingsConst.TILE_SIZE/2, -SettingsConst.TILE_SIZE/2),
            new Point(SettingsConst.TILE_SIZE/2, -SettingsConst.TILE_SIZE/2)
         ];
         if (rectanglePointsDoIntersect(tileVertexOffsets, (hitbox as RectangularHitbox).vertexOffsets, x, y, hitbox.object.position.x + hitbox.rotatedOffsetX, hitbox.object.position.y + hitbox.rotatedOffsetY, 1, 0, (hitbox as RectangularHitbox).axisX, (hitbox as RectangularHitbox).axisY)) {
            return true;
         }
      }
   }

   return false;
}

const tileIsOccupied = (tileIndex: number, tribe: Tribe): boolean => {
   const tileX = tileIndex % SettingsConst.TILES_IN_WORLD_WIDTH;
   const tileY = Math.floor(tileIndex / SettingsConst.TILES_IN_WORLD_WIDTH);

   const chunkX = Math.floor(tileX / SettingsConst.CHUNK_SIZE);
   const chunkY = Math.floor(tileY / SettingsConst.CHUNK_SIZE);
   const chunk = Board.getChunk(chunkX, chunkY);

   for (let i = 0; i < chunk.entities.length; i++) {
      const entity = chunk.entities[i];
      if (tribe.buildings.indexOf(entity) === -1) {
         continue;
      }

      if (entityCollidesWithTile(tileX, tileY, entity)) {
         return true;
      }
   }

   return false;
}

const getPotentialWallPlacePositions = (tribe: Tribe, building: Entity): ReadonlyArray<Point> => {
   const nodeIndexes = getEntityNodePositions(building);

   const occupyingTileIndexes = new Array<number>();
   for (let i = 0; i < nodeIndexes.length; i++) {
      const nodeIndex = nodeIndexes[i];

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

   console.log(neighbouringTileIndexes.map(n => {
      const tileX = n % SettingsConst.TILES_IN_WORLD_WIDTH;
      const tileY = Math.floor(n / SettingsConst.TILES_IN_WORLD_WIDTH);
      return tileX + "-" + tileY
   }).join(", "))

   // @Incomplete: Add tile positions which would connect to existing walls

   // Calculate wall place positions
   const placePositions = new Array<Point>();
   for (let i = 0; i < neighbouringTileIndexes.length; i++) {
      const tileIndex = neighbouringTileIndexes[i];
      if (tileIsOccupied(tileIndex, tribe)) {
         continue;
      }

      placePositions.push(tileIndex);
   }

   return placePositions;
}

const findIdealWallPlacePosition = (tribe: Tribe, building: Entity): BuildingPlan | null => {
   const potentialWallPlacePositions = getPotentialWallPlacePositions(tribe, building);
   if (potentialWallPlacePositions.length === 0) {
      // Unable to find a position
      return null;
   }

   const realNodes = tribe.vulnerabilityNodes;
   const realNodeRecord = tribe.vulnerabilityNodeRecord;
   
   // Simulate placing each position to see which one reduces vulnerability the most
   let minVulnerability = Vars.MAX_VULNERABILITY + 1;
   let bestTileIndex = 0;
   for (let i = 0; i < potentialWallPlacePositions.length; i++) {
      const tileIndex = potentialWallPlacePositions[i];

      const occupiedNodeIndexes = getVulnerabilityNodePositions(tribe);
      addTileNodePositions(tileIndex, occupiedNodeIndexes);

      updateTribeVulnerabilityNodes(tribe, occupiedNodeIndexes);

      const vulnerability = getBuildingVulnerability(tribe, building);
      if (vulnerability < minVulnerability) {
         minVulnerability = vulnerability;
         bestTileIndex = tileIndex;
      }

      // Reset back to real nodes
      tribe.vulnerabilityNodes = realNodes;
      tribe.vulnerabilityNodeRecord = realNodeRecord;
   }

   if (minVulnerability > Vars.MAX_VULNERABILITY) {
      throw new Error();
   }

   const tileX = bestTileIndex % SettingsConst.TILES_IN_WORLD_WIDTH;
   const tileY = Math.floor(bestTileIndex / SettingsConst.TILES_IN_WORLD_WIDTH);
   const position = new Point((tileX + 0.5) * SettingsConst.TILE_SIZE, (tileY + 0.5) * SettingsConst.TILE_SIZE);

   return {
      position: position,
      rotation: 0,
      placeableItemType: ItemType.wooden_wall
   };
}

export function updateTribeNextBuilding(tribe: Tribe): void {
   // Priorities:
   // 1) Protect vulnerable buildings

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

export function getVisibleBuildingPlans(chunkBounds: VisibleChunkBounds): ReadonlyArray<BuildingPlanData> {
   // Calculate visible tribes
   // @Speed: We calculate this same thing for both visible vulnerability nodes and visible building plans
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

   const buildingPlansData = new Array<BuildingPlanData>();
   for (let i = 0; i < visibleTribes.length; i++) {
      const tribe = visibleTribes[i];

      if (tribe.buildingPlan !== null) {
         buildingPlansData.push({
            x: tribe.buildingPlan.position.x,
            y: tribe.buildingPlan.position.y,
            rotation: tribe.buildingPlan.rotation,
            entityType: IEntityType.wall
         });
      }
   }

   return buildingPlansData;
}