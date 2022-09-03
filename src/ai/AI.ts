import { EntityType, Point, SETTINGS, Vector } from "webgl-test-shared";
import Entity from "../entities/Entity";
import { SERVER } from "../server";

const MAX_TILE_RANGE_CALCULATE_DEPTH = 9;
// don't ask
const TILE_RANGE_RECORD: Record<number, Record<number, Record<number, Array<[number, number]>>>> = {};
for (let x = 0; x < SETTINGS.BOARD_DIMENSIONS; x++) {
   TILE_RANGE_RECORD[x] = {};
   for (let y = 0; y < SETTINGS.BOARD_DIMENSIONS; y++) {
      TILE_RANGE_RECORD[x][y] = {};

      for (let depth = 0; depth <= MAX_TILE_RANGE_CALCULATE_DEPTH; depth++) {
         const minX = Math.max(x - depth, 0);
         const maxX = Math.min(x + depth, SETTINGS.BOARD_DIMENSIONS - 1);
         const minY = Math.max(y - depth, 0);
         const maxY = Math.min(y + depth, SETTINGS.BOARD_DIMENSIONS - 1);

         const nearbyTiles = new Array<[number, number]>();
         for (let currentX = minX; currentX <= maxX; currentX++) {
            for (let currentY = minY; currentY <= maxY; currentY++) {
               const dist = (Math.pow(currentX - x, 2) + Math.pow(currentY - y, 2));
               if (dist <= depth) nearbyTiles.push([currentX, currentY]);
            }
         }

         TILE_RANGE_RECORD[x][y][depth] = nearbyTiles;
      }
   }
}

abstract class AI {
   protected readonly entity: Entity<EntityType>;

   /** Mob's target position. Not supposed to be modified in child classes. */
   protected targetPosition: Point | null = null;

   constructor(entity: Entity<EntityType>) {
      this.entity = entity;
   }

   protected getEntitiesInRadius(radius: number): Array<Entity<EntityType>> {
      const minChunkX = Math.max(Math.floor((this.entity.position.x - radius) / SETTINGS.TILE_SIZE / SETTINGS.BOARD_SIZE), 0);
      const maxChunkX = Math.min(Math.ceil((this.entity.position.x + radius) / SETTINGS.TILE_SIZE / SETTINGS.BOARD_SIZE), SETTINGS.BOARD_SIZE - 1);
      const minChunkY = Math.max(Math.floor((this.entity.position.y - radius) / SETTINGS.TILE_SIZE / SETTINGS.BOARD_SIZE), 0);
      const maxChunkY = Math.min(Math.ceil((this.entity.position.y + radius) / SETTINGS.TILE_SIZE / SETTINGS.BOARD_SIZE), SETTINGS.BOARD_SIZE - 1);

      const entities = new Array<Entity<EntityType>>();
      for (let chunkX = minChunkX; chunkX <= maxChunkX; chunkX++) {
         for (let chunkY = minChunkY; chunkY <= maxChunkY; chunkY++) {
            const chunk = SERVER.board.getChunk(chunkX, chunkY);

            for (const entity of chunk.getEntities()) {
               if (entity === this.entity) continue;

               const dist = this.entity.position.distanceFrom(entity.position);
               if (dist <= radius) entities.push(entity);
            }
         }
      }

      return entities;
   }

   public tick(): void {
      // If the entity has a reached its target position, stop moving
      if (this.hasReachedTargetPosition()) {
         this.stopMoving();
      }
   }

   private hasReachedTargetPosition(): boolean {
      if (this.targetPosition === null || this.entity.velocity === null) return false;

      const relativeTargetPosition = this.entity.position.subtract(this.targetPosition);
      const dotProduct = this.entity.velocity!.convertToPoint().dot(relativeTargetPosition);
      return dotProduct > 0;
   }

   protected moveToPosition(targetPosition: Point, acceleration: number, terminalVelocity: number): void {
      const angle = this.entity.position.angleBetween(targetPosition);

      this.entity.acceleration = new Vector(acceleration, angle);
      this.entity.terminalVelocity = terminalVelocity;
      this.entity.rotation = angle;

      this.targetPosition = targetPosition;
   }

   /**
    * Moves in a specific direction. Will not stop unless told to.
    * @param direction - The angle that the mob will move at (radians)
    */
   protected moveInDirection(direction: number, acceleration: number, terminalVelocity: number): void {
      this.entity.acceleration = new Vector(direction, acceleration);
      this.entity.terminalVelocity = terminalVelocity;
      this.entity.rotation = direction;

      this.targetPosition = null;
   }

   protected stopMoving(): void {
      this.entity.acceleration = null;
      this.entity.terminalVelocity = 0;

      this.targetPosition = null;
   }

   protected findNearbyTileCoordinates(range: number): Array<[number, number]> {
      const [ x, y ] = this.entity.findCurrentTileCoordinates();
      const nearbyTiles = TILE_RANGE_RECORD[x][y][range];
      return nearbyTiles;
   }
}

export default AI;