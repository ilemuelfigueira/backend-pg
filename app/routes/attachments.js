import { BlobReader, BlobWriter, ZipWriter } from "@zip.js/zip.js";

import { UserRolesEnum } from "../enums/users.enum.js";
import { supabaseCreateClient } from "../lib/supabase.js";

const supabase = supabaseCreateClient();

/**
 *
 * @param {import("fastify").FastifyInstance} fastify
 * @param {import("fastify").FastifyServerOptions} options
 */
export default async function (fastify, options) {
  fastify.post(
    "/upload",
    {
      onRequest: [fastify.authenticate],
    },
    async (request, reply) => {
      const { session } = request.headers;

      if (!session) return reply.status(401).send({ message: "Unauthorized" });

      const user = session.user;

      const userRole = user?.user_metadata?.role || "cliente";

      if (userRole === UserRolesEnum.CLIENTE)
        return reply.status(403).send({ message: "Forbidden" });

      const files = request.files();

      try {
        for await (const file of files) {
          const fileBuffer = await file.toBuffer();
          const fileName = `teste/${file.filename}`;
          const fileType = file.mimetype;

          // Log para depuração
          console.log("Nome do arquivo:", fileName);
          console.log("Tipo de arquivo:", fileType);
          console.log("Tamanho do buffer:", fileBuffer.length);

          // Validar tipo de arquivo
          const allowedTypes = [
            "image/png",
            "image/jpeg",
            "video/mp4",
            "application/zip",
          ];
          if (!allowedTypes.includes(fileType)) {
            return reply
              .status(400)
              .send({ error: "Tipo de arquivo não suportado." });
          }

          // Fazer upload para o Supabase
          await uploadToSupabase(fileBuffer, fileName, fileType);
        }

        reply.send({ success: true });
      } catch (error) {
        console.error(`Erro ao fazer upload de arquivos.`);
        console.error(error.message);
        reply.status(500).send({ error: error.message });
      }
    }
  );

  fastify.get("/download/:folder", async (request, reply) => {
    const { folder } = request.params;
    const { data, error } = await supabase.storage
      .from("attachments")
      .list(folder);

    if (error) {
      return reply.status(500).send({
        message: error,
      });
    }

    if (!data.length) {
      return reply.status(404).send({
        message: "Arquivos não foram encontrados.",
      });
    }

    // Definindo o tipo de conteúdo da resposta como ZIP
    // reply.header("Content-Type", "application/zip");
    reply.header("Content-Type", "application/json");
    // Definindo o header para forçar o download do arquivo ZIP
    reply.header("Content-Disposition", `attachment; filename=${folder}.zip`);

    // Create a new zip file
    const zipFileWriter = new BlobWriter("application/zip");
    const zipWriter = new ZipWriter(zipFileWriter, { bufferedWrite: true });

    for await (const file of data) {
      try {
        const { data, error } = await supabase.storage
          .from("attachments")
          .download(`${folder}/${file.name}`);

        if (error) {
          return reply.status(500).send(`Failed to fetch file: ${file.name}`);
        }

        zipWriter.add(file.name, new BlobReader(data));
      } catch (err) {
        console.error(err.message);
        return reply.status(500).send(`Error fetching file: ${file.name}`);
      }
    }

    const zipFile = await zipWriter.close();

    const arrbuffer = await zipFile.arrayBuffer();

    return reply.status(200).send(Buffer.from(arrbuffer));
  });
}

async function uploadToSupabase(fileBuffer, fileUrl, fileType) {
  const { data, error } = await supabase.storage
    .from("attachments")
    .upload(fileUrl, fileBuffer, {
      contentType: fileType,
    });

  if (error) {
    throw error;
  }

  return data;
}
