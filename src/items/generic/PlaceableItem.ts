import { EntityType, ItemType, PlaceableItemInfo, Point, SETTINGS, Vector } from "webgl-test-shared";
import Entity from "../../entities/Entity";
import ENTITY_CLASS_RECORD from "../../entity-classes";
import RectangularHitbox from "../../hitboxes/RectangularHitbox";
import StackableItem from "./StackableItem";
import { SERVER } from "../../server";
import Board from "../../Board";

type PlaceableItemHitboxInfo = {
   readonly width: number;
   readonly height: number;
}

const PLACEABLE_ITEM_HITBOX_INFO: Partial<Record<ItemType, PlaceableItemHitboxInfo>> = {
   workbench: {
      width: 80,
      height: 80
   }
};

class PlaceableItem extends StackableItem implements PlaceableItemInfo {
   private static readonly placeTestHitbox: RectangularHitbox = new RectangularHitbox();
   
   public readonly entityType: EntityType;

   private readonly entityClass: new (position: Point, ...args: any[]) => Entity;

   constructor(itemType: ItemType, count: number, itemInfo: PlaceableItemInfo) {
      super(itemType, count, itemInfo);

      this.entityType = itemInfo.entityType;

      this.entityClass = ENTITY_CLASS_RECORD[this.entityType]();
   }

   public use(entity: Entity, inventoryName: string): void {
      // Calculate the position to spawn the placeable entity at
      const spawnPosition = entity.position.copy();
      const offsetVector = new Vector(SETTINGS.ITEM_PLACE_DISTANCE, entity.rotation);
      spawnPosition.add(offsetVector.convertToPoint());

      // Make sure the placeable item can be placed
      if (!this.canBePlaced(spawnPosition, entity.rotation)) return;
      
      // Spawn the placeable entity
      const placedEntity = new this.entityClass(spawnPosition, false);

      // Rotate it to match the entity's rotation
      placedEntity.rotation = entity.rotation;

      super.consumeItem(entity.getComponent("inventory")!, inventoryName, 1);
   }

   private canBePlaced(spawnPosition: Point, rotation: number): boolean {
      // Update the place test hitbox to match the placeable item's info
      const { width, height } = PLACEABLE_ITEM_HITBOX_INFO[this.type]!;

      const tempHitboxObject = {
         position: spawnPosition,
         rotation: rotation
      };

      PlaceableItem.placeTestHitbox.setHitboxObject(tempHitboxObject);

      PlaceableItem.placeTestHitbox.setHitboxInfo({
         type: "rectangular",
         width: width,
         height: height
      });

      PlaceableItem.placeTestHitbox.computeVertexPositions();
      PlaceableItem.placeTestHitbox.calculateSideAxes();

      const minChunkX = Math.max(Math.min(Math.floor((spawnPosition.x - width / 2) / SETTINGS.TILE_SIZE / SETTINGS.CHUNK_SIZE), SETTINGS.BOARD_SIZE - 1), 0);
      const maxChunkX = Math.max(Math.min(Math.floor((spawnPosition.x + width / 2) / SETTINGS.TILE_SIZE / SETTINGS.CHUNK_SIZE), SETTINGS.BOARD_SIZE - 1), 0);
      const minChunkY = Math.max(Math.min(Math.floor((spawnPosition.y - height / 2) / SETTINGS.TILE_SIZE / SETTINGS.CHUNK_SIZE), SETTINGS.BOARD_SIZE - 1), 0);
      const maxChunkY = Math.max(Math.min(Math.floor((spawnPosition.y + height / 2) / SETTINGS.TILE_SIZE / SETTINGS.CHUNK_SIZE), SETTINGS.BOARD_SIZE - 1), 0);
      
      const previouslyCheckedEntityIDs = new Set<number>();

      for (let chunkX = minChunkX; chunkX <= maxChunkX; chunkX++) {
         for (let chunkY = minChunkY; chunkY <= maxChunkY; chunkY++) {
            const chunk = Board.getChunk(chunkX, chunkY);
            for (const entity of chunk.getEntities()) {
               if (!previouslyCheckedEntityIDs.has(entity.id)) {
                  for (const hitbox of entity.hitboxes) {   
                     if (PlaceableItem.placeTestHitbox.isColliding(hitbox)) {
                        return false;
                     }
                  }
                  
                  previouslyCheckedEntityIDs.add(entity.id);
               }
            }
         }
      }

      return true;
   }
}

export default PlaceableItem;