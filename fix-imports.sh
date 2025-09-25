#!/bin/bash

# 修復所有路由檔案中的 @server/* 別名導入
cd server/routes

# 替換所有 @server/* 別名為相對路徑
find . -name "*.ts" -exec sed -i 's|from "@server/storage"|from "../../../storage"|g' {} \;
find . -name "*.ts" -exec sed -i 's|from "@server/gemini"|from "../../../gemini"|g' {} \;
find . -name "*.ts" -exec sed -i 's|from "@server/gcp-storage"|from "../../../gcp-storage"|g' {} \;
find . -name "*.ts" -exec sed -i 's|from "@server/embedding-service"|from "../../../embedding-service"|g' {} \;
find . -name "*.ts" -exec sed -i 's|from "@server/chunking-service"|from "../../../chunking-service"|g' {} \;
find . -name "*.ts" -exec sed -i 's|from "@server/retrieval-service"|from "../../../retrieval-service"|g' {} \;
find . -name "*.ts" -exec sed -i 's|from "@server/functions"|from "../../../functions"|g' {} \;

echo "所有導入路徑已修復完成！"
