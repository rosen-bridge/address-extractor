import { BoxEntity } from "../entities/boxEntity";
import { DataSource } from "typeorm";
import ExtractedBox from "../interfaces/ExtractedBox";
import { BlockEntity } from "@rosen-bridge/scanner";

export class BoxEntityAction {
    private readonly datasource: DataSource;

    constructor(dataSource: DataSource) {
        this.datasource = dataSource;
    }

    /**
     * It stores list of blocks in the dataSource with block id
     * @param boxes
     * @param spendBoxes
     * @param block
     * @param extractor
     */
    storeBox = async (boxes: Array<ExtractedBox>, spendBoxes: Array<string>, block: BlockEntity, extractor: string) => {
        const boxEntities = boxes.map((box) => {
            const row = new BoxEntity();
            row.address = box.address;
            row.boxId = box.boxId;
            row.createBlock = block.hash
            row.creationHeight = block.height
            row.serialized = box.serialized
            row.extractor = extractor
            return row;
        });
        let success = true;
        const queryRunner = this.datasource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();
        try {
            await queryRunner.manager.save(boxEntities);
            await this.datasource.getRepository(BoxEntity).createQueryBuilder()
                .update()
                .set({spendBlock: block.hash})
                .where("boxId IN (:boxes) AND extractor = :extractor", {
                    boxes: spendBoxes,
                    extractor: extractor
                }).execute()
            await queryRunner.commitTransaction();
        } catch (e) {
            console.log(`An error occurred during store boxes action: ${e}`)
            await queryRunner.rollbackTransaction();
            success = false;
        } finally {
            await queryRunner.release();
        }
        return success;
    }

    /**
     * delete boxes in specific block from database. if box spend in this block marked as unspent
     * and if created in this block remove it from database
     * @param block
     * @param extractor
     */
    deleteBlockBoxes = async (block: string, extractor: string) => {
        await this.datasource.createQueryBuilder()
            .delete()
            .from(BoxEntity)
            .where("extractor = :extractor AND createBlock = :block", {
                "block": block,
                "extractor": extractor
            }).execute()
        await this.datasource.getRepository(BoxEntity).createQueryBuilder()
            .update()
            .set({spendBlock: null})
            .where("spendBlock = :block AND extractor = :extractor", {
                "block": block,
                "extractor": extractor
            }).execute()
    }

}
