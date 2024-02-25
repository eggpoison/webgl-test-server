import { SettingsConst, randInt } from "webgl-test-shared";
import Entity from "../Entity";
import Tile from "../Tile";
import Board from "../Board";
import { WanderAIComponentArray } from "../components/ComponentArray";
import { moveEntityToPosition } from "../ai-shared";

export function runWanderAI(entity: Entity, wanderRate: number): void {
   // Only try to wander if not moving
   if (entity.velocity.x !== 0 || entity.velocity.y !== 0 || Math.random() >= wanderRate / SettingsConst.TPS) {
      return;
   }
}

export function shouldWander(entity: Entity, wanderRate: number) {
   return entity.velocity.x === 0 && entity.velocity.y === 0 && Math.random() < wanderRate / SettingsConst.TPS;
}

export function getWanderTargetTile(entity: Entity, visionRange: number): Tile {
   const minTileX = Math.max(Math.floor((entity.position.x - visionRange) / SettingsConst.TILE_SIZE), 0);
   const maxTileX = Math.min(Math.floor((entity.position.x + visionRange) / SettingsConst.TILE_SIZE), SettingsConst.BOARD_DIMENSIONS - 1);
   const minTileY = Math.max(Math.floor((entity.position.y - visionRange) / SettingsConst.TILE_SIZE), 0);
   const maxTileY = Math.min(Math.floor((entity.position.y + visionRange) / SettingsConst.TILE_SIZE), SettingsConst.BOARD_DIMENSIONS - 1);

   let attempts = 0;
   let tileX: number;
   let tileY: number;
   do {
      tileX = randInt(minTileX, maxTileX);
      tileY = randInt(minTileY, maxTileY);
   } while (++attempts <= 50 && Math.pow(entity.position.x - (tileX + 0.5) * SettingsConst.TILE_SIZE, 2) + Math.pow(entity.position.y - (tileY + 0.5) * SettingsConst.TILE_SIZE, 2) > visionRange * visionRange);

   return Board.getTile(tileX, tileY);
}

export function wander(entity: Entity, x: number, y: number, acceleration: number): void {
   const wanderAIComponent = WanderAIComponentArray.getComponent(entity.id);
   wanderAIComponent.targetPositionX = x;
   wanderAIComponent.targetPositionY = y;
   moveEntityToPosition(entity, wanderAIComponent.targetPositionX, wanderAIComponent.targetPositionY, acceleration);
}