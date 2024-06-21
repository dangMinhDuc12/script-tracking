const express = require('express');
const app = express();
const db = require('./db');
const fs = require('fs');
const damageJson = require('./damage.json');
const imageRangeJson = require('./image_range.json');
const vehiclePartJson = require('./vehicle_part.json');
const errorStatus = require('./error_status.json');
const pool = require('./db');
const _ = require('lodash');
const { Parser } = require('@json2csv/plainjs');
const parser = new Parser();
const moment = require('moment');
const XLSX = require('xlsx');
const { log } = require('console');
const camelcaseKeys = require('camelcase-keys');
const dbAidata = require('./dbAIData');
const url = require('url');
const pgFormat = require('pg-format');

const dbStageLocal = require('./dbStageLocal');
const dbStageAWS = require('./dbStageAWS');
const dbLocal = require('./dbLocal');
const dbDev = require('./dbDev');

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.post('/tracking', async (req, res, next) => {
  //   const { startTime, endTime } = req.body
  //   const getImages = await pool.query(`
  //   SELECT
  //     image_id,
  //     claim_id,
  //     url,
  //     created_date,
  //     image_range_id,
  //     direction_id,
  //     time_process,
  //     engine_corner,
  //     status,
  //     error_uuid,
  //     trace_id
  //   FROM insurance_claim_images
  //   WHERE owner_organization_id = 2 AND created_date::date BETWEEN '${startTime}' AND '${endTime}'
  //   ORDER BY created_date ASC
  //   `
  //   )
  //   const images = getImages.rows;
  //   const imageIds = images.map(image => image.image_id)
  //   const [getCarParts, getCarDamages, getCarInfos] = await Promise.all([pool.query(`SELECT scores, image_id, vehicle_part_excel_id FROM insurance_claim_images_segments WHERE image_id IN (${imageIds})`), pool.query(`SELECT damage_percentage, classes, image_id, vehicle_part_excel_id FROM insurance_claim_results WHERE image_id IN (${imageIds})`), pool.query(`SELECT image_id, car_company, car_model, car_color, plate_number FROM insurance_claim_car_info WHERE image_id IN (${imageIds})`)])
  //   const carParts = getCarParts.rows
  //   const carDamages = getCarDamages.rows
  //   const carInfos = getCarInfos.rows
  //   const average = arr => arr.reduce( ( p, c ) => p + c, 0 ) / arr.length;
  //   const output = images.map(image => {
  //     const currentCarInfo = carInfos.find(carInfo => carInfo.image_id == image.image_id)
  //     const currentCarPart = carParts.filter(carPart => carPart.image_id == image.image_id)
  //     const currentCarDamage = carDamages.filter(carDamage => carDamage.image_id == image.image_id)
  //     return {
  //       filePath: image.url,
  //       imageLink: `https://dyta7vmv7sqle.cloudfront.net/${image.url}`,
  //       claimId: image.claim_id,
  //       timeProcess: image.time_process,
  //       status: image.status,
  //       errorMsg: errorStatus[image.error_uuid],
  //       carPlate: _.get(currentCarInfo, 'plate_number'),
  //       carCompany: _.get(currentCarInfo, 'car_company'),
  //       carModel: _.get(currentCarInfo, 'car_model'),
  //       carColor: _.get(currentCarInfo, 'car_color'),
  //       totalCarPart: currentCarPart.length,
  //       avgCarPartScore: average(currentCarPart.map(cp => cp.scores)) || 0,
  //       detailDamages: currentCarDamage.map(carDamage => ({
  //         carPartName: vehiclePartJson[carDamage.vehicle_part_excel_id],
  //         damageName: damageJson[carDamage.classes],
  //         damagePercent: carDamage.damage_percentage
  //       })),
  //       date: moment(image.created_date).format('YYYY-MM-DD HH:mm:ss'),
  //       engineCorner: image.engine_corner,
  //       traceId: image.trace_id
  //     }
  //   })
  //   const csv = parser.parse(output)
  // res.attachment('filename.csv');
  // res.status(200).send(csv);
  // })
  // app.post('/get-image-folder', async (req, res, next) => {
  //   const getFolder = await pool.query(`select ic.claim_id from insurance_claims ic where ic.owner_organization_id = 5 and date(ic.created_date) between '2023-02-01' and '2023-02-24'`)
  //   const folder = getFolder.rows;
  //   const folderIds = folder.map(f => f.claim_id)
  //   const getImageWithFolders = await pool.query(`select url, claim_id from insurance_claim_images where claim_id in (${folderIds}) and image_type = 'image'`)
  //   const images = getImageWithFolders.rows
  //   const workbook = XLSX.utils.book_new();
  //   folderIds.forEach(f => {
  //     const imagesInFolder = images.filter(i => i.claim_id == f)
  //     if(imagesInFolder.length) {
  //       const worksheet = XLSX.utils.json_to_sheet(imagesInFolder);
  //       XLSX.utils.book_append_sheet(workbook, worksheet, f);
  //     }
  //   })
  //   XLSX.writeFile(workbook, "test.xlsx", { compression: true });
  //   res.status(200).end();

  const startTime = '2024-03-15';
  const endTime = '2024-06-15';

  const getFolders =
    await pool.query(`SELECT ic.claim_id, ic.vehicle_license_plates, date(ic.created_date + interval '7 hours')
  from insurance_claims ic
  where ic.owner_organization_id = 5 and date(ic.created_date + interval '7 hours') between '${startTime}' and '${endTime}' order by date(ic.created_date + interval '7 hours');`);

  const folders = getFolders.rows;

  const claimIds = folders.map((f) => f.claim_id);

  const getCarInfos = await pool.query(
    `SELECT claim_id, car_company, car_model FROM insurance_claim_car_info WHERE claim_id IN (${claimIds})`
  );

  const carInfos = getCarInfos.rows;

  const getClaimImages = await pool.query(
    `select count(image_id), claim_id from insurance_claim_images where image_type = 'image' and claim_id IN (${claimIds}) group by claim_id;`
  );

  const claimImages = getClaimImages.rows;

  const getClaimImageIds = await pool.query(
    `SELECT image_id FROM insurance_claim_images WHERE claim_id IN (${claimIds})`
  );

  const claimImageIds = getClaimImageIds.rows.map((r) => r.image_id);

  const getClaimImageRaw = await pool.query(
    `
    SELECT
      image_id,
      raw_result
    FROM insurance_claim_images_raw
    WHERE image_id IN (${claimImageIds.join(',')})
    `
  );

  const claimImageRaw = getClaimImageRaw.rows;

  const countRequest = await pool.query(`
    select count(image_id) from insurance_claim_images where owner_organization_id = 5 and date(created_date + interval '7 hours') between '${startTime}' and '${endTime}';
  
  `);

  const countFolder = await pool.query(`
    select count(claim_id) from insurance_claims where owner_organization_id = 5 and date(created_date + interval '7 hours') between '${startTime}' and '${endTime}';
  
  `);

  const output = folders.map((f) => {
    const currentCarInfo = carInfos.find((c) => {
      return c.claim_id == f.claim_id && !!c.car_company;
    });

    const currentResultRaw = claimImageRaw.find((r) => {
      return r.raw_result.claimId == f.claim_id;
    });

    const currentClaimImageCount = claimImages.find((ci) => ci.claim_id == f.claim_id);

    return {
      claimId: f.claim_id,
      date: moment(f.date).format('YYYY-MM-DD'),
      carCompany: currentCarInfo
        ? currentCarInfo.car_company
        : currentResultRaw
        ? currentResultRaw.raw_result.carInfo.carCompany
        : null,
      carModel: currentCarInfo
        ? currentCarInfo.car_model
        : currentResultRaw
        ? currentResultRaw.raw_result.carInfo.carModel
        : null,
      licensePlate: f.vehicle_license_plates,
      numOfPhoto: currentClaimImageCount ? currentClaimImageCount.count : 0,
    };
  });

  const worksheet = XLSX.utils.json_to_sheet(output);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet);
  XLSX.writeFile(workbook, 'OPES.csv');

  //   const getImages = await pool.query(
  //     `SELECT image_id, concat('https://dyta7vmv7sqle.cloudfront.net/', url) as image_url, claim_id, time_process, created_date FROM insurance_claim_images WHERE owner_organization_id = 2 and created_date::date = '2023-07-25' and image_type = 'image'`
  //   );

  //   const images = getImages.rows;

  //   const imageIds = images.map((i) => i.image_id);

  //   const getDamages =
  //     await pool.query(`SELECT count(claim_result_id) as num_of_damage, image_id FROM insurance_claim_results WHERE image_id IN (${imageIds})
  // GROUP BY image_id`);

  //   const damages = getDamages.rows;

  //   console.log(damages);

  //   const output = images.map((i) => {
  //     const currentDamage = damages.find((d) => d.image_id == i.image_id);

  //     return {
  //       imageId: i.image_id,
  //       imageUrl: i.image_url,
  //       claimId: i.claim_id,
  //       timeProcess: i.time_process,
  //       numOfDamages: currentDamage ? currentDamage.num_of_damage : 0,
  //       createdDate: moment(i.created_date).format('YYYY-MM-DD HH:MM:ss'),
  //     };
  //   });

  //   const worksheet = XLSX.utils.json_to_sheet(output);
  //   const workbook = XLSX.utils.book_new();
  //   XLSX.utils.book_append_sheet(workbook, worksheet);
  //   XLSX.writeFile(workbook, 'VBI.csv');

  res.status(200).send({ countRequest: countRequest.rows, countFolder: countFolder.rows });
});

app.post('/map-output', async (req, res, next) => {
  const wb = XLSX.readFile('./output.xlsx');
  const sheets = wb.SheetNames;
  let rawData = camelcaseKeys(XLSX.utils.sheet_to_json(wb.Sheets[sheets[0]]));

  rawData = rawData.map((r) => {
    return {
      ...r,
      imageNameInDb: `${r.inspecImageId}.jpg`,
    };
  });

  const imagesName = rawData.map((r) => `'${r.imageNameInDb}'`);

  const sql = `SELECT 
    image_name, image_id, url, claim_id
  FROM insurance_claim_images 
  WHERE image_name IN (${imagesName}) AND image_type = 'image' AND deleted_flag = false
  ORDER BY created_date DESC
  `;

  const getImages = await pool.query(sql);
  const images = camelcaseKeys(getImages.rows);

  const imageIds = images.map((img) => img.imageId);
  const claimIds = images.map((img) => img.claimId);

  const sqlGetCarInfo = `
    SELECT
      image_id, 
      car_company,
      car_model,
      car_color,
      plate_number,
      car_corner_engine
    FROM insurance_claim_car_info
    WHERE image_id IN(${imageIds})
  `;

  const sqlGetCarPart = `
    SELECT
      image_id,
      vehicle_part_excel_id
    FROM insurance_claim_images_segments
    WHERE image_id IN(${imageIds})
  `;

  const sqlGetResultCallBack = `
    SELECT
      claim_id,
      car_plate
    FROM results_callback
    WHERE claim_id IN(${claimIds})
  `;

  const [getCarInfos, getCarParts, getResultsCallBack] = await Promise.all([
    pool.query(sqlGetCarInfo),
    pool.query(sqlGetCarPart),
    pool.query(sqlGetResultCallBack),
  ]);

  const carInfos = camelcaseKeys(getCarInfos.rows);
  const carParts = camelcaseKeys(getCarParts.rows);
  const resultsCallBack = camelcaseKeys(getResultsCallBack.rows);

  rawData = rawData.map((r) => {
    const imagesWithName = images.filter((img) => img.imageName === r.imageNameInDb);
    const currentImg = imagesWithName.reduce(function (prev, current) {
      return prev && Number(prev.imageId) > Number(current.imageId) ? prev : current;
    });

    const currentCarInfo = carInfos.find((ci) => Number(ci.imageId) === Number(currentImg.imageId));
    const currentCarParts = carParts.filter(
      (cp) => Number(cp.imageId) === Number(currentImg.imageId)
    );

    const currentResultCallBack = resultsCallBack.find(
      (rc) => Number(rc.claimId) === Number(currentImg.claimId)
    );

    return {
      ...r,
      imgUrl: `https://dyta7vmv7sqle.cloudfront.net/${currentImg.url}`,
      carCompany: currentCarInfo?.carCompany,
      carModel: currentCarInfo?.carModel,
      carColor: currentCarInfo?.carColor,
      plateNumber: currentCarInfo?.plateNumber,
      carCornerEngine: currentCarInfo?.carCornerEngine,
      carParts: JSON.stringify(currentCarParts.map((c) => c.vehiclePartExcelId)),
      imageId: currentImg.imageId,
      carPlateCallBack: _.get(currentResultCallBack, 'carPlate'),
    };
  });

  const worksheet = XLSX.utils.json_to_sheet(rawData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet);
  XLSX.writeFile(workbook, 'OPES_mapped.csv');

  return res.status(200).send('ok');
});

app.post('/count-label', async (req, res, next) => {
  const getTag = await dbAidata.query(
    `SELECT tag_id, tag_name FROM tags WHERE project_id = 17910 and tag_name ILIKE 'test%'`
  );

  const tags = getTag.rows.map((t) => t.tag_id);
  console.log({ tags });

  const getSource = await dbAidata.query(`
      SELECT source_id, tags
      FROM label_source
      WHERE project_id = 17910 and tags::jsonb <@ '[${tags.join(',')}]'::jsonb
    `);

  const sources = getSource.rows.map((s) => s.source_id);
  const getCountLabel = await dbAidata.query(`
      SELECT label_point_id, source_id FROM label_point WHERE source_id IN (${sources.join(',')})
    `);

  let totalAll = 0;
  const countLabelWithTag = getTag.rows.reduce((acc, t) => {
    const currentSourceWithTag = getSource.rows.filter((s) => {
      return Number(s.tags[0]) === Number(t.tag_id);
    });

    if (currentSourceWithTag.length) {
      let totalCurrentSourceWithTag = 0;
      currentSourceWithTag.forEach((s) => {
        const currentLabelPointWithSource = getCountLabel.rows.filter((lb) => {
          return Number(lb.source_id) === Number(s.source_id);
        });
        totalCurrentSourceWithTag += currentLabelPointWithSource.length;
      });

      totalAll += totalCurrentSourceWithTag;

      acc.push({
        tagName: t.tag_name,
        total: totalCurrentSourceWithTag,
      });
    }

    return acc;
  }, []);

  const worksheet = XLSX.utils.json_to_sheet(countLabelWithTag);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet);
  XLSX.writeFile(workbook, 'count_label_with_tag.csv');

  return res.status(200).send({ totalAll });
});

app.post('/get-link-img-aidata', async (req, res, next) => {
  const wb = XLSX.readFile('./imgLink.xlsx');
  const sheets = wb.SheetNames;
  const rawData = camelcaseKeys(XLSX.utils.sheet_to_json(wb.Sheets[sheets[0]]));
  const sourceIds = rawData.map((r) => {
    return url.parse(r.imgUrl, true).query.sourceId;
  });

  const getSource = await dbAidata.query(
    `SELECT concat('https://dlznmeedga846.cloudfront.net/',url) as url  FROM label_source WHERE source_id = ANY ($1)`,
    [sourceIds]
  );

  const source = getSource.rows.map((gr) => {
    return gr.url;
  });

  const worksheet = XLSX.utils.json_to_sheet(getSource.rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet);
  XLSX.writeFile(workbook, 'source.csv');

  return res.status(200).send({ source });
});

app.post('/backUpDb', async (req, res, next) => {
  const getClaimFolder = await dbStageLocal.query(`
      SELECT * FROM insurance_claims WHERE date(created_date + interval '7 hours') between '2024-04-15' and '2024-04-17' and owner_organization_id = 5 and type = 'video' and deleted_flag = false
  
  `);

  const claimFolder = getClaimFolder.rows;

  for (let i = 0; i < claimFolder.length; i++) {
    const currentClaimFolder = claimFolder[i];
    const currentFolderColumn = Object.keys(currentClaimFolder).filter((cf) => {
      return cf !== 'claim_id';
    });

    const currentFolderValue = currentFolderColumn.map((c) => {
      return currentClaimFolder[c];
    });

    const arrayKey = Array.from({ length: currentFolderColumn.length }, (_, i) => `$${i + 1}`);

    const getClaimImageFolder = await dbStageLocal.query(
      `SELECT * FROM insurance_claim_images WHERE claim_id = ${currentClaimFolder.claim_id}`
    );

    const claimImages = getClaimImageFolder.rows;

    const getClaimSegmentFolder = await dbStageLocal.query(
      `SELECT * FROM insurance_claim_images_segments WHERE claim_id = ${currentClaimFolder.claim_id}`
    );

    const segments = getClaimSegmentFolder.rows;

    const getClaimResultFolder = await dbStageLocal.query(
      `SELECT * FROM insurance_claim_results WHERE claim_id = ${currentClaimFolder.claim_id}`
    );

    const results = getClaimResultFolder.rows;

    const getClaimCarInfoFolder = await dbStageLocal.query(
      `SELECT * FROM insurance_claim_car_info WHERE claim_id = ${currentClaimFolder.claim_id}`
    );

    const carInfos = getClaimCarInfoFolder.rows;

    const insertNewFolder = await dbStageAWS.query(
      `
        INSERT INTO insurance_claims (${currentFolderColumn.join(', ')}) VALUES (${arrayKey})
        RETURNING claim_id
    `,
      [...currentFolderValue]
    );

    const newFolderId = insertNewFolder.rows[0].claim_id;

    for (let j = 0; j < claimImages.length; j++) {
      const currentImage = claimImages[j];

      const columnImages = Object.keys(currentImage).filter((c) => c !== 'image_id');
      const arrayKeyImages = Array.from({ length: columnImages.length }, (_, i) => `$${i + 1}`);
      const currentImagesValue = columnImages.map((c) => {
        if (c === 'claim_id') {
          currentImage[c] = newFolderId;
        }

        if (c === 'confident_level') {
          currentImage[c] = JSON.stringify(currentImage[c]);
        }

        if (c === 'image_size') {
          currentImage[c] = JSON.stringify(currentImage[c]);
        }

        return currentImage[c];
      });

      const insertNewClaimImage = await dbStageAWS.query(
        `
      INSERT INTO insurance_claim_images (${columnImages.join(', ')}) VALUES (${arrayKeyImages})
      RETURNING image_id

    `,
        [...currentImagesValue]
      );

      const newImageId = insertNewClaimImage.rows[0].image_id;

      const currentSegmentsList = segments.filter((s) => s.image_id == currentImage.image_id);

      if (currentSegmentsList.length) {
        for (let k = 0; k < currentSegmentsList.length; k++) {
          const currentSegment = currentSegmentsList[k];

          const columnSegment = Object.keys(currentSegment).filter((c) => {
            return c !== 'segment_id';
          });

          const arrayKeySegment = Array.from(
            { length: columnSegment.length },
            (_, i) => `$${i + 1}`
          );

          const currentSegmentValue = columnSegment.map((c) => {
            if (c === 'claim_id') {
              currentSegment[c] = newFolderId;
            }

            if (c === 'image_id') {
              currentSegment[c] = newImageId;
            }

            if (c === 'boxes') {
              currentSegment[c] = JSON.stringify(currentSegment[c]);
            }
            return currentSegment[c];
          });

          const insertNewSegment = await dbStageAWS.query(
            `
      INSERT INTO insurance_claim_images_segments (${columnSegment.join(
        ', '
      )}) VALUES (${arrayKeySegment})
      RETURNING segment_id

    `,
            [...currentSegmentValue]
          );

          const newSegmentId = insertNewSegment.rows[0].segment_id;
        }
      }

      const currentResultList = results.filter((r) => r.image_id == currentImage.image_id);

      if (currentResultList.length) {
        for (let l = 0; l < currentResultList.length; l++) {
          const currentResult = currentResultList[l];

          const columnResult = Object.keys(currentResult).filter((c) => {
            return c !== 'claim_result_id';
          });

          const arrayKeyResult = Array.from({ length: columnResult.length }, (_, i) => `$${i + 1}`);

          const currentResultValue = columnResult.map((c) => {
            if (c === 'claim_id') {
              currentResult[c] = newFolderId;
            }

            if (c === 'image_id') {
              currentResult[c] = newImageId;
            }

            if (c === 'boxes') {
              currentResult[c] = JSON.stringify(currentResult[c]);
            }

            return currentResult[c];
          });

          const insertNewResult = await dbStageAWS.query(
            `
      INSERT INTO insurance_claim_results (${columnResult.join(', ')}) VALUES (${arrayKeyResult})
      RETURNING claim_result_id

    `,
            [...currentResultValue]
          );

          const newResultId = insertNewResult.rows[0].claim_result_id;
        }
      }

      const currentCarInfo = carInfos.find((ci) => ci.image_id == currentImage.image_id);

      if (currentCarInfo) {
        const columnCarInfo = Object.keys(currentCarInfo).filter((c) => {
          return c !== 'claim_car_info_id';
        });

        const arrayKeyCarInfo = Array.from({ length: columnCarInfo.length }, (_, i) => `$${i + 1}`);

        const currentCarInfoValue = columnCarInfo.map((c) => {
          if (c === 'claim_id') {
            currentCarInfo[c] = newFolderId;
          }

          if (c === 'image_id') {
            currentCarInfo[c] = newImageId;
          }

          return currentCarInfo[c];
        });

        const insertNewCarInfo = await dbStageAWS.query(
          `
      INSERT INTO insurance_claim_car_info (${columnCarInfo.join(', ')}) VALUES (${arrayKeyCarInfo})
      RETURNING claim_car_info_id

    `,
          [...currentCarInfoValue]
        );

        const newCarInfoId = insertNewCarInfo.rows[0].claim_car_info_id;
      }
    }

    log({ currentClaimFolder: currentClaimFolder.claim_id, newFolder: newFolderId });
  }

  return res.status(200).send('ok');
});

app.post('/import-classify-data', async (req, res, next) => {
  await dbDev.query(`DELETE FROM public.vehicle_part_reference_damages`, []);

  const wb = XLSX.readFile('./Rule phân loại vết hỏng.xlsx');
  const sheets = wb.SheetNames;
  const rawData = camelcaseKeys(XLSX.utils.sheet_to_json(wb.Sheets[sheets[0]]));

  const dataInsertDb = rawData.map((r) => {
    return [
      r['tênBộPhậnCóVếtHỏng'],
      r['tênBộPhậnThamChiếu'],
      r['biênNặng'],
      r['biênTrungBình'],
      r['biênNhẹ'],
    ];
  });

  const sql = `INSERT INTO public.vehicle_part_reference_damages (vehicle_part_slug, vehicle_part_reference_slug, severe_damage_percent, moderate_damage_percent, slight_damage_percent)
  VALUES %L
  ON CONFLICT(vehicle_part_slug, vehicle_part_reference_slug)
  DO NOTHING
  `;

  await dbDev.query(pgFormat(sql, dataInsertDb), []);

  return res.status(200).send('ok');
});

app.post('/import-vni-unmapping-data', async (req, res, next) => {
  await dbLocal.query(`DELETE FROM public.car_version_unmapping_by_org`, []);

  const getOrgInfo = await dbLocal.query(
    `SELECT organization_id FROM sso.organization WHERE organization_name = $1`,
    ['VNI']
  );

  const orgId = _.get(getOrgInfo, 'rows[0].organization_id');

  const wb = XLSX.readFile('./Checked-VNI-CHUANHOA-DATA-20240506.xlsx');
  const sheets = wb.SheetNames;

  const rawData = camelcaseKeys(XLSX.utils.sheet_to_json(wb.Sheets[sheets[3]]));

  const dataInsertDb = rawData.map((r) => {
    return [_.trim(r['hang']), _.trim(r['ma']), orgId, r['loạiXe']];
  });

  const sql = `
  INSERT INTO public.car_version_unmapping_by_org (car_company_name, car_model_name, org_id, car_type)
  VALUES %L
  `;

  await dbLocal.query(pgFormat(sql, dataInsertDb), []);

  return res.status(200).send('ok');
});

app.post('/clone-label-source', async (req, res, next) => {
  const getImageHasLabelPoint = await dbAidata.query(`
      select distinct ls.source_id
    from label_source ls
    inner join label_point lp on ls.source_id = lp.source_id
    where ls.dataset_id = 18931 limit 10;
    `);
  const imageIdsHasLabelPoint = getImageHasLabelPoint.rows.map((ilp) => ilp.source_id);

  for (let i = 0; i < imageIdsHasLabelPoint.length; i++) {
    const currentImageId = imageIdsHasLabelPoint[i];

    const getCurrentLabelSourceInfo = await dbAidata.query(`
        SELECT * FROM label_source WHERE source_id = ${currentImageId}
      `);

    const currentSouceInfo = getCurrentLabelSourceInfo.rows[0];
    const currentSourceInfoColumn = Object.keys(currentSouceInfo).filter((cs) => {
      return cs !== 'source_id';
    });
    const arrayKeySouce = Array.from(
      { length: currentSourceInfoColumn.length },
      (_, i) => `$${i + 1}`
    );

    const currentSourceInfoValue = currentSourceInfoColumn.map((cs) => {
      if (cs === 'dataset_id') {
        currentSouceInfo[cs] = 18949;
      }

      return currentSouceInfo[cs];
    });

    //clone source//
    const insertNewLabelSource = await dbAidata.query(
      `
        INSERT INTO label_source (${currentSourceInfoColumn.join(', ')}) VALUES (${arrayKeySouce})
        RETURNING source_id
      
      `,
      [...currentSourceInfoValue]
    );
    //clone source//

    const newSouceId = insertNewLabelSource.rows[0];

    const getCurrentLabelPointWithSource = await dbAidata.query(`
        SELECT * FROM label_point WHERE source_id = ${currentImageId}
      `);

    const currentLabelPointWithSouce = getCurrentLabelPointWithSource.rows;

    for (let j = 0; j < currentLabelPointWithSouce.length; j++) {
      const currentPoint = currentLabelPointWithSouce[j];

      const currentLabelPointColumn = Object.keys(currentPoint).filter((ci) => {
        return ci !== 'label_point_id';
      });

      const arrayKeyPoint = Array.from(
        { length: currentLabelPointColumn.length },
        (_, i) => `$${i + 1}`
      );

      const currentPointValue = currentLabelPointColumn.map((ci) => {
        if (ci === 'dataset_id') {
          currentPoint[ci] = 18949;
        }

        if (ci === 'source_id') {
          currentPoint[ci] = newSouceId.source_id;
        }

        if (ci === 'data_point') {
          currentPoint[ci] = JSON.stringify(currentPoint[ci]);
        }

        return currentPoint[ci];
      });

      //clone point//

      // console.log(currentLabelPointColumn, currentPointValue);

      const insertNewLabelPoint = await dbAidata.query(
        `
        INSERT INTO label_point (${currentLabelPointColumn.join(', ')}) VALUES (${arrayKeyPoint})
        RETURNING label_point_id

      `,
        [...currentPointValue]
      );

      // console.log(insertNewLabelPoint.rows);

      //clone point//
    }
  }

  return res.status(200).send('ok');
});

app.listen(6302, () => {
  console.log(`Server is running on port 6302`);
});
