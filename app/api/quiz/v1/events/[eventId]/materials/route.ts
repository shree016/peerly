import { NextRequest, NextResponse } from "next/server";

import {
  isQuizApiError,
  quizErrorBody,
  requireAdmin,
} from "@/features/quiz/lib/auth";
import {
  listQuizEventMaterials,
  uploadAndIndexQuizMaterial,
} from "@/features/quiz/lib/quiz-materials";
import { getOwnedEvent } from "@/features/quiz/lib/quiz-materials-access";

import { isS3Configured } from "@/lib/s3/storage";

// Upload → S3 → text extraction → embeddings all run inside this request.
// Raise this if your hosting plan allows and large files time out.
export const maxDuration = 60;

type RouteContext = { params: Promise<{ eventId: string }> };

function eventNotFound() {
  return NextResponse.json(
    { error: { code: "EVENT_NOT_FOUND", message: "Event not found." } },
    { status: 404 },
  );
}

export async function GET(_request: NextRequest, { params }: RouteContext) {
  const { eventId } = await params;

  try {
    const admin = await requireAdmin();
    const event = await getOwnedEvent(admin.id, eventId);
    if (!event) return eventNotFound();

    const materials = await listQuizEventMaterials(eventId);
    return NextResponse.json({ materials });
  } catch (error) {
    if (isQuizApiError(error)) {
      return NextResponse.json(quizErrorBody(error), { status: error.status });
    }
    console.error("Failed to load quiz materials:", error);
    return NextResponse.json(
      { error: { code: "SERVER_ERROR", message: "Failed to load materials." } },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  const { eventId } = await params;

  try {
    // Authorise before reading a potentially 25 MB body.
    const admin = await requireAdmin();
    const event = await getOwnedEvent(admin.id, eventId);
    if (!event) return eventNotFound();

    if (!isS3Configured()) {
      return NextResponse.json(
        {
          error: {
            code: "STORAGE_NOT_CONFIGURED",
            message: "File storage is not configured.",
          },
        },
        { status: 503 },
      );
    }

    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return NextResponse.json(
        {
          error: {
            code: "INVALID_FORM",
            message: "Expected multipart form data.",
          },
        },
        { status: 400 },
      );
    }

    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "file is required.",
            field: "file",
          },
        },
        { status: 400 },
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const material = await uploadAndIndexQuizMaterial({
      eventId,
      adminId: admin.id,
      fileName: file.name,
      contentType: file.type,
      buffer,
    });

    return NextResponse.json({ material }, { status: 201 });
  } catch (error) {
    if (isQuizApiError(error)) {
      return NextResponse.json(quizErrorBody(error), { status: error.status });
    }
    console.error("Quiz material upload failed:", error);
    return NextResponse.json(
      {
        error: {
          code: "UPLOAD_FAILED",
          message:
            error instanceof Error
              ? error.message
              : "Failed to upload and index material.",
        },
      },
      { status: 500 },
    );
  }
}
