import { EntityType, ItemType, PlaceableItemInfo, Point, Vector } from "webgl-test-shared";
import Entity from "../../entities/Entity";
import ENTITY_CLASS_RECORD from "../../entity-class-record";
import StackableItem from "./StackableItem";

class PlaceableItem extends StackableItem implements PlaceableItemInfo {
   /** Distance from the player that the item is placed at */
   private static readonly PLACE_DISTANCE = 100;
   
   public readonly entityType: EntityType;

   private readonly entityClass: new (position: Point, ...args: any[]) => Entity;
   
   constructor(itemType: ItemType, count: number, itemInfo: PlaceableItemInfo) {
      super(itemType, count, itemInfo);

      this.entityType = itemInfo.entityType;

      this.entityClass = ENTITY_CLASS_RECORD[this.entityType]();
   }

   public getAttackDamage(): number {
      return 1;
   }

   public use(entity: Entity): void {
      const entityPosition = entity.position.copy();
      const offsetVector = new Vector(PlaceableItem.PLACE_DISTANCE, entity.rotation);
      entityPosition.add(offsetVector.convertToPoint());
      
      // Spawn the placeable entity
      const placedEntity = new this.entityClass(entityPosition);

      // Rotate it to match the entity's rotation
      placedEntity.rotation = entity.rotation;

      super.consumeItem(entity.getComponent("inventory")!, 1);
   }
}

export default PlaceableItem;