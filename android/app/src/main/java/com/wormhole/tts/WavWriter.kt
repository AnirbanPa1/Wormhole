package com.wormhole.tts

import com.k2fsa.sherpa.onnx.GeneratedAudio
import java.io.File

object WavWriter {
    
    /**
     * Writes GeneratedAudio to a WAV file.
     *
     * Audio is first written to a temporary file and then renamed so
     * Wormhole never sees a partially-written/corrupt cache entry.
     */
    
    fun write(
        audio: GeneratedAudio,
        outputPath: String,
    ): File {
        require(audio.samples.isNotEmpty()) {
            "Cannot write empty audio"
        }

        require(audio.sampleRate > 0) {
            "Invalid sample rate: ${audio.sampleRate}"
        }

        val outputFile = File(outputPath)

        outputFile.parentFile?.let { parent ->
            if (!parent.exists()) {
                check(parent.mkdirs()) {
                    "Failed to create output directory: ${parent.absolutePath}"
                }
            }
        }

        val tempFile = File(
                outputFile.parentFile,
                "${outputFile.name}.tmp.wav"
        )

        // Remove leftovers from a previously interrupted write.
        if (tempFile.exists()) {
            tempFile.delete()
        }

        val success = audio.save(tempFile.absolutePath)

        check(success) {
            "sherpa-onnx failed to write WAV: ${tempFile.absolutePath}"
        }

        check(tempFile.exists() && tempFile.length() > 44) {
            tempFile.delete()
            "Generated WAV is invalid or empty"
        }

        if (outputFile.exists()) {
            check(outputFile.delete()) {
                tempFile.delete()
                "Unable to replace existing WAV: ${outputFile.absolutePath}"
            }
        }

        check(tempFile.renameTo(outputFile)) {
            tempFile.delete()
            "Unable to move generated WAV to ${outputFile.absolutePath}"
        }

        return outputFile
    }
}
