import path from "path";
import { google } from "googleapis";
import fs from "fs";

export async function uploadToGoogleDrive(
  filePath: string,
  driveFolderId: string
) {
  console.log(
    `[Google Drive] ${path.basename(filePath)} のアップロードを開始...`
  );

  // 1. 認証クライアントを作成
  const auth = new google.auth.GoogleAuth({
    keyFile: process.env.KEY_FILE_PATH || "",
    scopes: ["https://www.googleapis.com/auth/drive.file"],
  });

  // 2. Drive APIのインスタンスを取得
  const drive = google.drive({ version: "v3", auth });

  // 3. ファイルのメタデータを定義
  const fileMetadata = {
    name: path.basename(filePath),
    parents: [driveFolderId],
  };

  // 4. アップロードするファイル本体を定義
  const media = {
    mimeType: "video/mp4",
    body: fs.createReadStream(filePath), // ファイルストリームとして読み込む
  };

  try {
    const response = await drive.files.create({
      requestBody: fileMetadata,
      media: media,
      fields: "id", // レスポンスとしてファイルIDを取得
    });
    console.log(
      `[Google Drive] アップロード完了！ File ID: ${response.data.id}`
    );
    return response.data.id;
  } catch (error) {
    const err = error as Error;
    console.error(
      "[Google Drive] アップロード中にエラーが発生しました:",
      err.message
    );
    throw error; // エラーを呼び出し元に伝える
  }
}

export async function appendToSpreadsheet(
  rowData: string[],
  spreadsheetId: string
) {
  console.log("[Google Sheets] スプレッドシートへの追記を開始...");

  // 1. 認証クライアントを作成
  const auth = new google.auth.GoogleAuth({
    keyFile: process.env.KEY_FILE_PATH || "",
    scopes: [
      "https://www.googleapis.com/auth/drive.file", // Drive用スコープ
      "https://www.googleapis.com/auth/spreadsheets", // Sheets用スコープ
    ],
  });

  // 2. Sheets APIのインスタンスを取得
  const sheets = google.sheets({ version: "v4", auth });

  try {
    await sheets.spreadsheets.values.append({
      spreadsheetId: spreadsheetId,
      range: "シート1!A1", // 追記を開始する範囲。'シート1'の部分は実際のシート名に合わせてください。A1は必須ではありませんが、シート名を指定します。
      valueInputOption: "USER_ENTERED", // ユーザーが入力したかのようにデータを解釈する
      requestBody: {
        values: [
          rowData, // 2次元配列でデータを渡す
        ],
      },
    });
    console.log("[Google Sheets] 追記が完了しました。");
  } catch (error) {
    const err = error as Error;
    console.error(
      "[Google Sheets] 追記中にエラーが発生しました:",
      err.message
    );
    throw error;
  }
}
