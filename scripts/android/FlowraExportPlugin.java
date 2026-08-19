package __APP_ID__;

import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.Typeface;
import android.graphics.pdf.PdfDocument;
import android.net.Uri;

import androidx.core.content.FileProvider;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStreamWriter;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

@CapacitorPlugin(name = "FlowraExport")
public class FlowraExportPlugin extends Plugin {
  private static final int PAGE_WIDTH = 595;
  private static final int PAGE_HEIGHT = 842;
  private static final int PAGE_MARGIN = 36;

  @PluginMethod
  public void exportText(PluginCall call) {
    String filename = call.getString("filename");
    String content = call.getString("content");
    String mimeType = call.getString("mimeType", "text/plain");
    String title = call.getString("title", "Flowra export");
    if (filename == null || filename.trim().isEmpty() || content == null) {
      call.reject("A filename and export content are required.");
      return;
    }
    try {
      File outputFile = exportFile(filename);
      try (OutputStreamWriter writer = new OutputStreamWriter(
        new FileOutputStream(outputFile, false),
        StandardCharsets.UTF_8
      )) {
        writer.write(content);
      }
      shareFile(outputFile, mimeType, title);
      call.resolve();
    } catch (ActivityNotFoundException error) {
      call.reject("No application can handle this export.");
    } catch (Exception error) {
      call.reject("Unable to export the CSV file.");
    }
  }

  @PluginMethod
  public void exportPdf(PluginCall call) {
    String filename = call.getString("filename");
    String content = call.getString("content");
    String title = call.getString("title", "Flowra period history");
    if (filename == null || filename.trim().isEmpty() || content == null) {
      call.reject("A filename and report content are required.");
      return;
    }
    try {
      String outputName = filename.toLowerCase().endsWith(".pdf") ? filename : filename + ".pdf";
      File outputFile = exportFile(outputName);
      writePdf(outputFile, title, content);
      shareFile(outputFile, "application/pdf", title);
      call.resolve();
    } catch (ActivityNotFoundException error) {
      call.reject("No application can handle this PDF.");
    } catch (Exception error) {
      call.reject("Unable to export the PDF file.");
    }
  }

  private File exportFile(String filename) throws Exception {
    File directory = new File(getContext().getCacheDir(), "exports");
    if (!directory.exists() && !directory.mkdirs()) {
      throw new IllegalStateException("Unable to prepare the export folder.");
    }
    String safeName = filename.trim().replaceAll("[^a-zA-Z0-9._-]", "_");
    return new File(directory, safeName.isEmpty() ? "flowra-export" : safeName);
  }

  private void writePdf(File outputFile, String fallbackTitle, String content) throws Exception {
    JSONObject report = new JSONObject(content);
    PdfDocument document = new PdfDocument();
    Paint titlePaint = paint(18, Color.rgb(199, 47, 104), true);
    Paint subtitlePaint = paint(11, Color.rgb(88, 66, 77), false);
    Paint headerPaint = paint(9, Color.rgb(45, 24, 35), true);
    Paint cellPaint = paint(8.5f, Color.rgb(45, 24, 35), false);
    Paint linePaint = paint(8, Color.rgb(118, 95, 107), false);

    int pageNumber = 1;
    PageState state = startPage(document, pageNumber);
    state.canvas.drawText(report.optString("title", fallbackTitle), PAGE_MARGIN, state.y, titlePaint);
    state.y += 21;
    String profile = report.optString("profile", "");
    if (!profile.isEmpty()) {
      state.canvas.drawText("Profile: " + profile, PAGE_MARGIN, state.y, subtitlePaint);
      state.y += 16;
    }
    state.canvas.drawText(
      "Generated: " + report.optString("generatedAt", ""),
      PAGE_MARGIN,
      state.y,
      linePaint
    );
    state.y += 24;
    drawHeader(state, headerPaint);

    JSONArray rows = report.optJSONArray("rows");
    if (rows != null) {
      for (int index = 0; index < rows.length(); index++) {
        JSONObject row = rows.optJSONObject(index);
        if (row == null) continue;
        String text = String.format(
          "%s    %s    %s    %s    %s",
          row.optString("start"),
          row.optString("end", "—"),
          row.optString("duration", "—"),
          row.optString("cycle", "—"),
          row.optString("excluded", "No")
        );
        List<String> lines = wrap(text, cellPaint, PAGE_WIDTH - (PAGE_MARGIN * 2));
        int rowHeight = Math.max(22, lines.size() * 12 + 8);
        if (state.y + rowHeight > PAGE_HEIGHT - PAGE_MARGIN) {
          document.finishPage(state.page);
          state = startPage(document, ++pageNumber);
          drawHeader(state, headerPaint);
        }
        for (String line : lines) {
          state.canvas.drawText(line, PAGE_MARGIN, state.y, cellPaint);
          state.y += 12;
        }
        state.y += 8;
      }
    }
    document.finishPage(state.page);
    try (FileOutputStream output = new FileOutputStream(outputFile, false)) {
      document.writeTo(output);
    } finally {
      document.close();
    }
  }

  private Paint paint(float size, int color, boolean bold) {
    Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
    paint.setTextSize(size);
    paint.setColor(color);
    if (bold) paint.setTypeface(Typeface.create(Typeface.DEFAULT, Typeface.BOLD));
    return paint;
  }

  private PageState startPage(PdfDocument document, int pageNumber) {
    PdfDocument.PageInfo info = new PdfDocument.PageInfo.Builder(
      PAGE_WIDTH,
      PAGE_HEIGHT,
      pageNumber
    ).create();
    PageState state = new PageState();
    state.page = document.startPage(info);
    state.canvas = state.page.getCanvas();
    state.y = PAGE_MARGIN;
    return state;
  }

  private void drawHeader(PageState state, Paint paint) {
    state.canvas.drawText(
      "Start        End          Duration    Cycle    Excluded",
      PAGE_MARGIN,
      state.y,
      paint
    );
    state.y += 18;
  }

  private List<String> wrap(String value, Paint paint, float width) {
    List<String> lines = new ArrayList<>();
    StringBuilder line = new StringBuilder();
    for (String word : value.split("\\s+")) {
      String next = line.length() == 0 ? word : line + " " + word;
      if (paint.measureText(next) <= width) {
        line.setLength(0);
        line.append(next);
      } else {
        if (line.length() > 0) lines.add(line.toString());
        line.setLength(0);
        line.append(word);
      }
    }
    if (line.length() > 0) lines.add(line.toString());
    if (lines.isEmpty()) lines.add("");
    return lines;
  }

  private void shareFile(File file, String mimeType, String title) {
    Uri uri = FileProvider.getUriForFile(
      getContext(),
      getContext().getPackageName() + ".fileprovider",
      file
    );
    Intent intent = new Intent(Intent.ACTION_SEND);
    intent.setType(mimeType);
    intent.putExtra(Intent.EXTRA_STREAM, uri);
    intent.putExtra(Intent.EXTRA_TITLE, title);
    intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
    getActivity().startActivity(Intent.createChooser(intent, title));
  }

  private static class PageState {
    PdfDocument.Page page;
    android.graphics.Canvas canvas;
    int y;
  }
}
