class KokoroEngine {
    private var tts: OfflineTts? = null

    fun initialize(
        modelDirectory: String,
        threadCount: Int
    ) {

    }

    fun synthesize(
        text: String,
        voiceId: Int,
        speed: Float
    ): GenerateAudio {

    }

    fun release() {
        
    }
}