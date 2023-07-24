import { GameObjectDebugData, Point, randInt, randItem, SETTINGS, TileType, veryBadHash } from "webgl-test-shared";
import HealthComponent from "../../entity-components/HealthComponent";
import ItemCreationComponent from "../../entity-components/ItemCreationComponent";
import Mob from "./Mob";
import Entity from "../Entity";
import CircularHitbox from "../../hitboxes/CircularHitbox";
import _GameObject from "../../GameObject";
import Board from "../../Board";
import Tile from "../../tiles/Tile";

/** Stores which tiles belong to which yetis' territories */
const yetiTerritoryTiles: Record<number, Yeti> = {};

const tileBelongsToYetiTerritory = (tileX: number, tileY: number): boolean => {
   const tileIndex = tileY * SETTINGS.BOARD_DIMENSIONS + tileX;
   return yetiTerritoryTiles.hasOwnProperty(tileIndex);
}

const registerYetiTerritory = (territory: ReadonlyArray<Tile>, yeti: Yeti): void => {
   for (const tile of territory) {
      const tileIndex = tile.y * SETTINGS.BOARD_DIMENSIONS + tile.x;
      yetiTerritoryTiles[tileIndex] = yeti;
   }
}

const removeYetiTerritory = (tileX: number, tileY: number): void => {
   const tileIndex = tileY * SETTINGS.BOARD_DIMENSIONS + tileX;
   delete yetiTerritoryTiles[tileIndex];
}

class Yeti extends Mob {
   private static readonly MAX_HEALTH = 100;

   private static readonly SIZE = 128;

   private static readonly CONTACT_DAMAGE = 3;
   private static readonly CONTACT_KNOCKBACK = 200;

   private static readonly YETI_TILES: ReadonlySet<TileType> = new Set(["snow", "ice", "permafrost"]);
   
   /** Minimum number of tiles that can belong to a yeti */
   private static readonly MIN_TERRITORY_SIZE = 50;
   private static readonly MAX_TERRITORY_SIZE = 100;

   private readonly territory: ReadonlyArray<Tile>;

   constructor(position: Point) {
      super(position, {
         health: new HealthComponent(Yeti.MAX_HEALTH, false),
         item_creation: new ItemCreationComponent()
      }, "yeti", SETTINGS.TILE_SIZE * 7, true);

      this.setAIParam("hunger", randInt(0, 50));
      this.setAIParam("metabolism", 1);

      this.addHitboxes([
         new CircularHitbox({
            type: "circular",
            radius: Yeti.SIZE / 2
         })
      ]);

      this.addAI("wander", {
         aiWeightMultiplier: 0.5,
         wanderRate: 0.6,
         acceleration: 100,
         terminalVelocity: 50,
         validTileTargets: Yeti.YETI_TILES,
         shouldWander: (position: Point): boolean => {
            const tileX = Math.floor(position.x / SETTINGS.TILE_SIZE);
            const tileY = Math.floor(position.y / SETTINGS.TILE_SIZE);
            const tile = Board.getTile(tileX, tileY);
            return this.territory.includes(tile);
         }
      });

      this.addAI("chase", {
         aiWeightMultiplier: 1,
         acceleration: 200,
         terminalVelocity: 100,
         entityIsChased: (entity: Entity) => {
            // Don't chase ice spikes
            if (entity.type === "ice_spikes") return false;
            
            // Chase the entity if they are in the yeti's territory
            return this.territory.includes(entity.tile);
         }
      });

      this.addAI("itemConsume", {
         aiWeightMultiplier: 0.8,
         acceleration: 100,
         terminalVelocity: 50,
         metabolism: 1,
         itemTargets: new Set(["raw_beef", "leather"])
      });

      this.createEvent("during_entity_collision", (collidingEntity: Entity): void => {
         // Don't damage ice spikes
         if (collidingEntity.type === "ice_spikes") return;
         
         const healthComponent = collidingEntity.getComponent("health");
         if (healthComponent !== null) {
            const hitDirection = this.position.calculateAngleBetween(collidingEntity.position);
            healthComponent.damage(Yeti.CONTACT_DAMAGE, Yeti.CONTACT_KNOCKBACK, hitDirection, this, "yeti");
            healthComponent.addLocalInvulnerabilityHash("yeti", 0.3);
         }
      });

      this.rotation = 2 * Math.PI * Math.random();

      this.getComponent("item_creation")!.createItemOnDeath("raw_beef", randInt(4, 7));
      this.getComponent("item_creation")!.createItemOnDeath("yeti_hide", randInt(2, 3));

      this.territory = Yeti.generateYetiTerritoryTiles(this.tile.x, this.tile.y);
      registerYetiTerritory(this.territory, this);

      this.createEvent("death", () => {
         for (const tile of this.territory) {
            removeYetiTerritory(tile.x, tile.y);
         }
      });
   }

   public getClientArgs(): [] {
      return [];
   }

   public getDebugData(): GameObjectDebugData {
      const debugData = super.getDebugData();

      const hash = veryBadHash(this.id.toString());
      
      // Generate rgb based on second, third and fourth digits of the hash
      const r = (Math.floor(hash / 10) % 10) / 10;
      const g = (Math.floor(hash / 10) % 100) / 100;
      const b = (Math.floor(hash / 10) % 1000) / 1000;
      
      for (const tile of this.territory) {
         debugData.tileHighlights.push(
            {
               tilePosition: [tile.x, tile.y],
               colour: [r, g, b]
            }
         );
      }
      
      return debugData;
   }

   private static generateYetiTerritoryTiles(originTileX: number, originTileY: number): ReadonlyArray<Tile> {
      // const checkedTiles = new Array<Tile>();
      const territoryTiles = new Array<Tile>();
      // Tiles to expand the territory from
      const spreadTiles = new Array<Tile>();

      const tileIsValid = (tile: Tile): boolean => {
         // Make sure the tile is inside the board
         if (tile.x < 0 || tile.x >= SETTINGS.BOARD_DIMENSIONS || tile.y < 0 || tile.y >= SETTINGS.BOARD_DIMENSIONS) {
            return false;
         }

         return tile.biomeName === "tundra" && !tileBelongsToYetiTerritory(tile.x, tile.y) && !territoryTiles.includes(tile);
      }

      const originTile = Board.getTile(originTileX, originTileY);
      territoryTiles.push(originTile);
      spreadTiles.push(originTile);
   
      while (spreadTiles.length > 0) {
         // Pick a random tile to expand from
         const idx = Math.floor(Math.random() * spreadTiles.length);
         const tile = spreadTiles[idx];

         const potentialTiles = [
            [tile.x + 1, tile.y],
            [tile.x - 1, tile.y],
            [tile.x, tile.y + 1],
            [tile.x, tile.y - 1]
         ];

         // Remove out of bounds tiles
         for (let i = 3; i >= 0; i--) {
            const tileCoordinates = potentialTiles[i];
            if (!Board.tileIsInBoard(tileCoordinates[0], tileCoordinates[1])) {
               potentialTiles.splice(i, 1);
            }
         }

         let numValidTiles = 0;

         for (let i = potentialTiles.length - 1; i >= 0; i--) {
            const tileCoordinates = potentialTiles[i];
            const tile = Board.getTile(tileCoordinates[0], tileCoordinates[1]);
            if (tileIsValid(tile)) {
               numValidTiles++;
            } else {
               potentialTiles.splice(i, 1);
            }
         }

         if (numValidTiles === 0) {
            spreadTiles.splice(idx, 1);
         } else {
            // Pick a random tile to expand to
            const [tileX, tileY] = randItem(potentialTiles);
            const tile = Board.getTile(tileX, tileY);
            territoryTiles.push(tile);
            spreadTiles.push(tile);
         }
   
         if (territoryTiles.length >= Yeti.MAX_TERRITORY_SIZE) {
            break;
         }
      }
   
      return territoryTiles;
   }

   public static spawnValidationFunction(position: Point): boolean {
      const originTileX = Math.floor(position.x / SETTINGS.TILE_SIZE);
      const originTileY = Math.floor(position.y / SETTINGS.TILE_SIZE);

      const territoryTiles = Yeti.generateYetiTerritoryTiles(originTileX, originTileY);
      return territoryTiles.length >= Yeti.MIN_TERRITORY_SIZE;
   }
}

export default Yeti;