import Entity from "./entities/Entity";
import Item from "./items/Item";

class Chunk {
   private readonly entities = new Array<Entity>();
   private readonly items = new Array<Item>();

   public readonly x: number;
   public readonly y: number;

   constructor(x: number, y: number) {
      this.x = x;
      this.y = y;
   }

   public addEntity(entity: Entity): void {
      this.entities.push(entity);
   }

   public removeEntity(entity: Entity): void {
      const idx = this.entities.indexOf(entity);
      this.entities.splice(idx, 1);
   }

   public hasEntity(entity: Entity): boolean {
      return this.entities.includes(entity);
   }

   public getEntities(): Array<Entity> {
      return this.entities;
   }

   public addItem(item: Item): void {
      this.items.push(item);
   }

   public removeItem(item: Item): void {
      this.items.splice(this.items.indexOf(item), 1);
   }

   public getItems(): Array<Item> {
      return this.items;
   }
}

export default Chunk;