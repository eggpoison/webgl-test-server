import { PathfindingNodeIndex } from "webgl-test-shared"

interface HeapItem {
   readonly node: PathfindingNodeIndex;
   heapIndex: number;
}

class PathfindingHeap {
   private readonly items = new Array<HeapItem>();
   public currentItemCount = 0;

   public gScore: Record<PathfindingNodeIndex, number> = {};
   public fScore: Record<PathfindingNodeIndex, number> = {};
   
   public addNode(node: PathfindingNodeIndex): void {
      const item: HeapItem = {
         node: node,
         heapIndex: this.currentItemCount
      };
      if (this.currentItemCount >= this.items.length) {
         this.items.push(item);
      } else {
         this.items[this.currentItemCount] = item;
      }
      this.sortUp(item);
      this.currentItemCount++;
   }

   public removeFirst(): PathfindingNodeIndex {
      const firstItem = this.items[0];
      this.currentItemCount--;
      this.items[0] = this.items[this.currentItemCount];
      this.items[0].heapIndex = 0;
      this.sortDown(this.items[0]);
      return firstItem.node;
   }

   public updateItem(item: HeapItem): void {
      this.sortUp(item);
   }

   public containsNode(node: PathfindingNodeIndex): boolean {
      // @Speed
      for (let i = 0; i < this.currentItemCount; i++) {
         const item = this.items[i];
         if (item.node === node) {
            return true;
         }
      }
      return false;
      // return this.items[item.heapIndex].node === item.node;
   }

   private sortDown(item: HeapItem): void {
      while (true) {
         const childIndexLeft = item.heapIndex * 2 + 1;
         const childIndexRight = item.heapIndex * 2 + 2;
         
         let swapIndex = 0;
         if (childIndexLeft < this.currentItemCount) {
            swapIndex = childIndexLeft;

            if (childIndexRight < this.currentItemCount) {
               if (this.compareTo(this.items[childIndexLeft], this.items[childIndexRight]) < 0) {
                  swapIndex = childIndexRight;
               }
            }

            if (this.compareTo(item, this.items[swapIndex]) < 0) {
               this.swap(item, this.items[swapIndex]);
            } else {
               return;
            }
         } else {
            return;
         }
      }
   }

   private sortUp(item: HeapItem): void {
      let parentIndex = Math.floor((item.heapIndex - 1) / 2); // @Speed
      while (parentIndex >= 0) { // @Speed: Prevent parent index from going negative!
         const parentItem = this.items[parentIndex];
         if (this.compareTo(item, parentItem) > 0) {
            this.swap(item, parentItem);
         } else {
            break; 
         }

         parentIndex = Math.floor((item.heapIndex - 1) / 2);
      }
   }

   private swap(item1: HeapItem, item2: HeapItem): void {
      this.items[item1.heapIndex] = item2;
      this.items[item2.heapIndex] = item1;

      const item1HeapIndex = item1.heapIndex;
      item1.heapIndex = item2.heapIndex;
      item2.heapIndex = item1HeapIndex;
   }

   private compareTo(item1: HeapItem, item2: HeapItem): number {
      let compare = this.fScore[item1.node] - this.fScore[item2.node];
      if (compare === 0) {
         const item1HCost = this.fScore[item1.node] - this.gScore[item1.node];
         const item2HCost = this.fScore[item2.node] - this.gScore[item2.node];
         compare = item1HCost - item2HCost;
      }
      return -compare;
   }
}

export default PathfindingHeap;